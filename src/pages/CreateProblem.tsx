import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { LatexRenderer } from '@/components/LatexRenderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const problemSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title too long'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(10000, 'Description too long'),
  cost_function: z.string().min(10, 'Cost function is required'),
  bounty: z.number().min(1, 'Bounty must be at least 1').max(10000, 'Bounty too high'),
  deadline: z.string().refine((val) => new Date(val) > new Date(), 'Deadline must be in the future'),
  tags: z.string().optional(),
  difficulty: z.string().optional(),
  test_min: z.number(),
  test_max: z.number(),
  test_count: z.number().min(1).max(100),
  time_penalty_per_ms: z.number().min(0),
});

// Common timezones with their UTC offsets
const TIMEZONES = [
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)', offset: -10 },
  { value: 'America/Anchorage', label: 'Alaska (AKST)', offset: -9 },
  { value: 'America/Los_Angeles', label: 'Pacific (PST)', offset: -8 },
  { value: 'America/Denver', label: 'Mountain (MST)', offset: -7 },
  { value: 'America/Chicago', label: 'Central (CST)', offset: -6 },
  { value: 'America/New_York', label: 'Eastern (EST)', offset: -5 },
  { value: 'America/Sao_Paulo', label: 'Brasília (BRT)', offset: -3 },
  { value: 'UTC', label: 'UTC', offset: 0 },
  { value: 'Europe/London', label: 'London (GMT)', offset: 0 },
  { value: 'Europe/Paris', label: 'Paris (CET)', offset: 1 },
  { value: 'Europe/Berlin', label: 'Berlin (CET)', offset: 1 },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)', offset: 3 },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 4 },
  { value: 'Asia/Kolkata', label: 'India (IST)', offset: 5.5 },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: 8 },
  { value: 'Asia/Shanghai', label: 'China (CST)', offset: 8 },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 9 },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', offset: 10 },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)', offset: 12 },
];

function getUserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONES.some(t => t.value === tz)) return tz;
    return 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function CreateProblem() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    cost_function: `def cost(test_input, solution_output):
    # Calculate how far the solution is from optimal
    # Lower cost = better solution
    expected = sum(test_input)  # Example: expected output
    return abs(solution_output - expected)`,
    bounty: '',
    deadline: '',
    tags: '',
    difficulty: '',
    test_min: '0',
    test_max: '100',
    test_count: '1',
    time_penalty_per_ms: '0.001',
  });
  const [timezone, setTimezone] = useState(getUserTimezone);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  // Convert datetime-local input (interpreted in selected timezone) to UTC ISO string
  const convertToUTC = (localDatetime: string, tz: string): string => {
    if (!localDatetime) return '';
    const tzData = TIMEZONES.find(t => t.value === tz);
    const offsetHours = tzData?.offset ?? 0;
    const [datePart, timePart] = localDatetime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    
    const utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
    const actualUtcMs = utcMs - (offsetHours * 60 * 60 * 1000);
    return new Date(actualUtcMs).toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!profile) {
      navigate('/auth');
      return;
    }

    try {
      const deadlineUTC = convertToUTC(form.deadline, timezone);
      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        cost_function: form.cost_function.trim(),
        bounty: parseFloat(form.bounty),
        deadline: deadlineUTC,
        tags: form.tags,
        difficulty: form.difficulty,
        test_min: parseFloat(form.test_min),
        test_max: parseFloat(form.test_max),
        test_count: parseInt(form.test_count),
        time_penalty_per_ms: parseFloat(form.time_penalty_per_ms),
      };

      problemSchema.parse(data);

      if (data.bounty > profile.currency) {
        setErrors({ bounty: `Insufficient funds. You have ${profile.currency.toFixed(2)} currency.` });
        return;
      }

      if (!data.cost_function.includes('def cost')) {
        setErrors({ cost_function: 'Cost function must define cost(test_input, solution_output)' });
        return;
      }

      setLoading(true);

      // Lock bounty from user's currency
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ currency: profile.currency - data.bounty })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Create problem
      const { data: problem, error: problemError } = await supabase
        .from('problems')
        .insert({
          creator_id: profile.id,
          title: data.title,
          description: data.description,
          cost_function: data.cost_function,
          bounty: data.bounty,
          deadline: data.deadline,
          tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
          difficulty: data.difficulty || null,
          test_inputs_range: {
            min: data.test_min,
            max: data.test_max,
            count: data.test_count,
          },
          time_penalty_per_ms: data.time_penalty_per_ms,
        })
        .select()
        .single();

      if (problemError) throw problemError;

      // Log transaction
      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'bounty_lock',
        amount: -data.bounty,
        problem_id: problem.id,
        description: `Bounty locked for problem: ${data.title}`,
      });

      await refreshProfile();

      toast({
        title: 'Problem created!',
        description: `Bounty of ${data.bounty} locked until deadline.`,
      });

      navigate(`/problem/${problem.id}`);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            fieldErrors[e.path[0] as string] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create problem. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8 max-w-3xl">
        <h1 className="font-serif text-3xl font-bold text-foreground mb-8">
          Create a Problem
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Problem Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Predict the stock price of AAPL"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={errors.title ? 'border-destructive' : ''}
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Description (supports LaTeX with $...$ or $$...$$)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? 'Edit' : 'Preview'}
                  </Button>
                </div>
                {showPreview ? (
                  <Card className="p-4 min-h-[150px] bg-muted/30">
                    <LatexRenderer content={form.description || 'Nothing to preview...'} />
                  </Card>
                ) : (
                  <Textarea
                    id="description"
                    placeholder="Describe the problem. What should the algorithm optimize? What is the cost function measuring?"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={`min-h-[150px] ${errors.description ? 'border-destructive' : ''}`}
                  />
                )}
                {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost Function (Python)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cost_function">
                  Define cost(test_input, solution_output) → lower is better
                </Label>
                <Textarea
                  id="cost_function"
                  value={form.cost_function}
                  onChange={(e) => setForm({ ...form, cost_function: e.target.value })}
                  className={`min-h-[200px] font-mono ${errors.cost_function ? 'border-destructive' : ''}`}
                />
                <p className="text-xs text-muted-foreground">
                  This function receives the test input and the output from a submitted algorithm.
                  Return a number representing the cost (0 = perfect solution).
                </p>
                {errors.cost_function && <p className="text-sm text-destructive">{errors.cost_function}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Input Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="test_min">Min Value</Label>
                  <Input
                    id="test_min"
                    type="number"
                    step="any"
                    value={form.test_min}
                    onChange={(e) => setForm({ ...form, test_min: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test_max">Max Value</Label>
                  <Input
                    id="test_max"
                    type="number"
                    step="any"
                    value={form.test_max}
                    onChange={(e) => setForm({ ...form, test_max: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test_count">Number of Values</Label>
                  <Input
                    id="test_count"
                    type="number"
                    min="1"
                    max="100"
                    value={form.test_count}
                    onChange={(e) => setForm({ ...form, test_count: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                At evaluation time, a random list of {form.test_count || 1} number(s) between {form.test_min || 0} and {form.test_max || 100} will be generated.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bounty & Deadline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bounty">Bounty Amount</Label>
                  <Input
                    id="bounty"
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="10"
                    value={form.bounty}
                    onChange={(e) => setForm({ ...form, bounty: e.target.value })}
                    className={errors.bounty ? 'border-destructive' : ''}
                  />
                  <p className="text-xs text-muted-foreground">
                    Available: {profile.currency.toFixed(2)}
                  </p>
                  {errors.bounty && <p className="text-sm text-destructive">{errors.bounty}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className={errors.deadline ? 'border-destructive' : ''}
                  />
                  {errors.deadline && <p className="text-sm text-destructive">{errors.deadline}</p>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label} (UTC{tz.offset >= 0 ? '+' : ''}{tz.offset})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time_penalty">Time Penalty (per ms)</Label>
                  <Input
                    id="time_penalty"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.time_penalty_per_ms}
                    onChange={(e) => setForm({ ...form, time_penalty_per_ms: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Currency deducted per millisecond of execution time
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="optimization, machine-learning, finance"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Input
                    id="difficulty"
                    placeholder="easy, medium, hard"
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/')}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Problem'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
