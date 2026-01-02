import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { LatexRenderer } from '@/components/LatexRenderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { PROBLEM_TEMPLATES, getTemplate, getDefaultTemplate } from '@/lib/problemTemplates';

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
  
  const defaultTemplate = getDefaultTemplate();
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplate.id);
  const [symbolInput, setSymbolInput] = useState('');
  const [delayHours, setDelayHours] = useState('24');
  
  const [form, setForm] = useState({
    title: '',
    description: defaultTemplate.defaultDescription,
    cost_function: defaultTemplate.defaultCostFunction,
    test_input_generator: defaultTemplate.defaultTestInputGenerator || '',
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
  const [validating, setValidating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [codeWarnings, setCodeWarnings] = useState<string[]>([]);

  // Update form when template changes
  useEffect(() => {
    const template = getTemplate(selectedTemplate);
    if (template) {
      setForm(prev => ({
        ...prev,
        description: template.defaultDescription,
        cost_function: template.defaultCostFunction,
        test_input_generator: template.defaultTestInputGenerator || '',
      }));
      if (template.defaultDelay) {
        setDelayHours(String(template.defaultDelay));
      }
    }
  }, [selectedTemplate]);

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

  const getCurrentTemplate = () => getTemplate(selectedTemplate) || defaultTemplate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!profile) {
      navigate('/auth');
      return;
    }

    const template = getCurrentTemplate();

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

      // Validate template-specific inputs
      if (template.hasSymbolInput && !symbolInput.trim()) {
        setErrors({ symbol: `${template.symbolLabel} is required` });
        return;
      }
      if (template.hasCityInput && !symbolInput.trim()) {
        setErrors({ symbol: `${template.symbolLabel} is required` });
        return;
      }

      setValidating(true);
      setCodeWarnings([]);

      // Validate cost function for security
      try {
        const costValidation = await supabase.functions.invoke('validate-code', {
          body: { code: data.cost_function, codeType: 'cost_function' }
        });

        if (costValidation.error) {
          throw new Error('Code validation service unavailable');
        }

        const costResult = costValidation.data;
        if (!costResult.isValid) {
          setErrors({ cost_function: `Security issue detected: ${costResult.issues.join(', ')}` });
          setValidating(false);
          return;
        }
        if (costResult.issues.length > 0) {
          setCodeWarnings(prev => [...prev, ...costResult.issues.map((i: string) => `Cost function: ${i}`)]);
        }

        // Validate test input generator if custom
        if (selectedTemplate === 'custom' && form.test_input_generator.trim()) {
          const genValidation = await supabase.functions.invoke('validate-code', {
            body: { code: form.test_input_generator, codeType: 'test_input_generator' }
          });

          if (!genValidation.error) {
            const genResult = genValidation.data;
            if (!genResult.isValid) {
              setErrors({ test_input_generator: `Security issue detected: ${genResult.issues.join(', ')}` });
              setValidating(false);
              return;
            }
            if (genResult.issues.length > 0) {
              setCodeWarnings(prev => [...prev, ...genResult.issues.map((i: string) => `Generator: ${i}`)]);
            }
          }
        }
      } catch (validationError) {
        console.warn('Code validation failed, proceeding with caution:', validationError);
      }

      setValidating(false);
      setLoading(true);

      // Build test input generator with symbol/city substitution
      let testInputGenerator = form.test_input_generator;
      if (template.hasSymbolInput) {
        testInputGenerator = testInputGenerator.replace(/\{\{SYMBOL\}\}/g, symbolInput.toUpperCase());
      }
      if (template.hasCityInput) {
        testInputGenerator = testInputGenerator.replace(/\{\{CITY\}\}/g, symbolInput);
      }

      // Build data source config
      let dataSourceConfig = null;
      if (template.hasSymbolInput) {
        dataSourceConfig = { symbol: symbolInput.toUpperCase() };
      } else if (template.hasCityInput) {
        dataSourceConfig = { city: symbolInput };
      }

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
          problem_type: selectedTemplate,
          test_input_generator: testInputGenerator || null,
          data_source_config: dataSourceConfig,
          evaluation_delay_hours: template.hasDelayHours ? parseInt(delayHours) : 0,
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

  const template = getCurrentTemplate();
  const showRandomInputConfig = selectedTemplate === 'optimization';
  const showTestInputGenerator = selectedTemplate === 'custom';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8 max-w-3xl">
        <h1 className="font-serif text-3xl font-bold text-foreground mb-8">
          Create a Problem
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Template Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Problem Type</CardTitle>
              <CardDescription>Choose a template to get started quickly</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {PROBLEM_TEMPLATES.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                      selectedTemplate === t.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <h3 className="font-medium text-foreground">{t.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Template-specific inputs */}
          {(template.hasSymbolInput || template.hasCityInput) && (
            <Card>
              <CardHeader>
                <CardTitle>Data Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="symbol">{template.symbolLabel}</Label>
                    <Input
                      id="symbol"
                      placeholder={template.symbolPlaceholder}
                      value={symbolInput}
                      onChange={(e) => setSymbolInput(e.target.value)}
                      className={errors.symbol ? 'border-destructive' : ''}
                    />
                    {errors.symbol && <p className="text-sm text-destructive">{errors.symbol}</p>}
                  </div>
                  
                  {template.hasDelayHours && (
                    <div className="space-y-2">
                      <Label htmlFor="delayHours">Prediction Window (hours)</Label>
                      <Input
                        id="delayHours"
                        type="number"
                        min="1"
                        max="168"
                        value={delayHours}
                        onChange={(e) => setDelayHours(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Final evaluation happens {delayHours}h after deadline
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Problem Details */}
          <Card>
            <CardHeader>
              <CardTitle>Problem Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder={template.hasSymbolInput ? `Predict ${symbolInput || template.symbolPlaceholder} price` : "Problem title"}
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

          {/* Test Input Generator (Custom only) */}
          {showTestInputGenerator && (
            <Card>
              <CardHeader>
                <CardTitle>Test Input Generator (Python)</CardTitle>
                <CardDescription>
                  Define generate_test_input() to create test inputs at evaluation time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={form.test_input_generator}
                  onChange={(e) => setForm({ ...form, test_input_generator: e.target.value })}
                  className={`min-h-[150px] font-mono ${errors.test_input_generator ? 'border-destructive' : ''}`}
                />
                <p className="text-xs text-muted-foreground">
                  Available fetchers: fetch_stock("AAPL"), fetch_crypto("BTC"), fetch_weather("New York"), fetch_random(min, max, count)
                </p>
                {errors.test_input_generator && <p className="text-sm text-destructive">{errors.test_input_generator}</p>}
              </CardContent>
            </Card>
          )}

          {/* Cost Function */}
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

          {/* Random Input Configuration (Optimization only) */}
          {showRandomInputConfig && (
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
          )}

          {/* Bounty & Deadline */}
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

          {/* Metadata */}
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

          {/* Security Warnings */}
          {codeWarnings.length > 0 && (
            <Card className="border-yellow-500/50 bg-yellow-500/10">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">⚠️ Code Warnings</p>
                <ul className="text-sm text-yellow-600 dark:text-yellow-500 list-disc pl-4 space-y-1">
                  {codeWarnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/')}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || validating}>
              {validating ? 'Validating code...' : loading ? 'Creating...' : 'Create Problem'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
