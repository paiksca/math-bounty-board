-- Add wallet_address to profiles for linking Ethereum wallet
ALTER TABLE public.profiles 
ADD COLUMN wallet_address text UNIQUE;

-- Add tx_hash to transactions for on-chain verification
ALTER TABLE public.transactions 
ADD COLUMN tx_hash text;

-- Create index for wallet lookups
CREATE INDEX idx_profiles_wallet_address ON public.profiles(wallet_address);

-- Create index for tx_hash lookups
CREATE INDEX idx_transactions_tx_hash ON public.transactions(tx_hash);

-- Update RLS to allow users to update their wallet_address
-- (existing policies should cover this as users can update own profile)