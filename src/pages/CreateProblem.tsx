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
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const problemSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title too long'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(10000, 'Description too long'),
  intended_answer: z.number({ invalid_type_error: 'Must be a number' }),
  bounty: z.number().min(1, 'Bounty must be at least 1').max(10000, 'Bounty too high'),
  deadline: z.string().refine((val) => new Date(val) > new Date(), 'Deadline must be in the future'),
  tags: z.string().optional(),
  difficulty: z.string().optional(),
  units: z.string().optional(),
});

export default function CreateProblem() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    intended_answer: '',
    bounty: '',
    deadline: '',
    tags: '',
    difficulty: '',
    units: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!profile) {
      navigate('/auth');
      return;
    }

    try {
      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        intended_answer: parseFloat(form.intended_answer),
        bounty: parseFloat(form.bounty),
        deadline: form.deadline,
        tags: form.tags,
        difficulty: form.difficulty,
        units: form.units,
      };

      problemSchema.parse(data);

      if (data.bounty > profile.currency) {
        setErrors({ bounty: `Insufficient funds. You have ${profile.currency.toFixed(2)} currency.` });
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
          intended_answer: data.intended_answer,
          bounty: data.bounty,
          deadline: data.deadline,
          tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
          difficulty: data.difficulty || null,
          units: data.units || null,
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
                  placeholder="What is the value of π²?"
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
                    placeholder="Find the exact value of $\int_0^1 x^2 dx$. Show your work is not required, just submit the numerical answer."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={`min-h-[150px] font-mono ${errors.description ? 'border-destructive' : ''}`}
                  />
                )}
                {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="intended_answer">Intended Answer (numerical)</Label>
                  <Input
                    id="intended_answer"
                    type="number"
                    step="any"
                    placeholder="9.8696044"
                    value={form.intended_answer}
                    onChange={(e) => setForm({ ...form, intended_answer: e.target.value })}
                    className={errors.intended_answer ? 'border-destructive' : ''}
                  />
                  {errors.intended_answer && <p className="text-sm text-destructive">{errors.intended_answer}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="units">Units (optional)</Label>
                  <Input
                    id="units"
                    placeholder="meters, kg, dimensionless"
                    value={form.units}
                    onChange={(e) => setForm({ ...form, units: e.target.value })}
                  />
                </div>
              </div>
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
                    placeholder="calculus, integration, physics"
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
