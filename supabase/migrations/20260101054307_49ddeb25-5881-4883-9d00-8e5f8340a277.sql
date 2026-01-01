-- Create app_role enum for admin functionality
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table for user data
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    currency DECIMAL(20, 6) NOT NULL DEFAULT 100.0,
    reputation DECIMAL(20, 6) NOT NULL DEFAULT 0.0,
    total_profit DECIMAL(20, 6) NOT NULL DEFAULT 0.0,
    is_frozen BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT positive_currency CHECK (currency >= 0)
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create problems table
CREATE TABLE public.problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    intended_answer DECIMAL(30, 10) NOT NULL,
    bounty DECIMAL(20, 6) NOT NULL,
    deadline TIMESTAMPTZ NOT NULL,
    tags TEXT[] DEFAULT '{}',
    difficulty TEXT,
    units TEXT,
    expected_scale TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'evaluated', 'invalidated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT positive_bounty CHECK (bounty > 0)
);

-- Create solutions table
CREATE TABLE public.solutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    submitter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    answer DECIMAL(30, 10) NOT NULL,
    stake DECIMAL(20, 6) NOT NULL,
    error DECIMAL(30, 10),
    payout DECIMAL(20, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT positive_stake CHECK (stake > 0),
    UNIQUE (problem_id, submitter_id)
);

-- Create transactions table for audit log
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('stake_lock', 'stake_return', 'bounty_lock', 'bounty_return', 'payout', 'reputation_change', 'admin_adjustment')),
    amount DECIMAL(20, 6) NOT NULL,
    problem_id UUID REFERENCES public.problems(id) ON DELETE SET NULL,
    solution_id UUID REFERENCES public.solutions(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get profile id from auth id
CREATE OR REPLACE FUNCTION public.get_profile_id(_auth_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = _auth_id
$$;

-- Profiles RLS policies
CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can update any profile (for freezing)
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- User roles RLS policies (only admins can see/modify)
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Problems RLS policies
CREATE POLICY "Problems are viewable by everyone"
ON public.problems FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create problems"
ON public.problems FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can update own problems"
ON public.problems FOR UPDATE
USING (creator_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Admins can update any problem"
ON public.problems FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Solutions RLS policies
-- Solutions are hidden until deadline passes
CREATE POLICY "Solutions visible after deadline or to owner"
ON public.solutions FOR SELECT
USING (
    submitter_id = public.get_profile_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR (SELECT deadline FROM public.problems WHERE id = problem_id) < now()
);

CREATE POLICY "Authenticated users can create solutions"
ON public.solutions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Transactions RLS policies
CREATE POLICY "Users can view own transactions"
ON public.transactions FOR SELECT
USING (user_id = public.get_profile_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_problems_updated_at
BEFORE UPDATE ON public.problems
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, username, currency, reputation)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substr(NEW.id::text, 1, 8)),
        100.0,
        0.0
    );
    RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();