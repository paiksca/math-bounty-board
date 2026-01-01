import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { LatexRenderer } from '@/components/LatexRenderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Clock, Coins, User, Trophy, AlertTriangle } from 'lucide-react';
import { format, isPast } from 'date-fns';

interface Problem {
  id: string;
  title: string;
  description: string;
  intended_answer: number;
  bounty: number;
  deadline: string;
  status: string;
  tags: string[];
  difficulty: string | null;
  units: string | null;
  creator: {
    id: string;
    username: string;
  };
}

interface Solution {
  id: string;
  answer: number;
  stake: number;
  error: number | null;
  payout: number | null;
  created_at: string;
  submitter: {
    id: string;
    username: string;
  };
}

export default function ProblemDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const [problem, setProblem] = useState<Problem | null>(null);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [userSolution, setUserSolution] = useState<Solution | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [answer, setAnswer] = useState('');
  const [stake, setStake] = useState('');

  useEffect(() => {
    if (id) {
      fetchProblem();
    }
  }, [id]);

  const fetchProblem = async () => {
    const { data: problemData, error: problemError } = await supabase
      .from('problems')
      .select(`
        *,
        creator:profiles!problems_creator_id_fkey(id, username)
      `)
      .eq('id', id)
      .single();

    if (problemError || !problemData) {
      setLoading(false);
      return;
    }

    setProblem({
      ...problemData,
      bounty: Number(problemData.bounty),
      intended_answer: Number(problemData.intended_answer),
    });

    // Fetch solutions (visible after deadline)
    const { data: solutionsData } = await supabase
      .from('solutions')
      .select(`
        *,
        submitter:profiles!solutions_submitter_id_fkey(id, username)
      `)
      .eq('problem_id', id)
      .order('payout', { ascending: false, nullsFirst: false });

    if (solutionsData) {
      const formatted = solutionsData.map((s) => ({
        ...s,
        answer: Number(s.answer),
        stake: Number(s.stake),
        error: s.error ? Number(s.error) : null,
        payout: s.payout ? Number(s.payout) : null,
      }));
      setSolutions(formatted);
      
      if (profile) {
        const mine = formatted.find((s) => s.submitter.id === profile.id);
        setUserSolution(mine || null);
      }
    }

    setLoading(false);
  };

  const handleSubmitSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile || !problem) return;
    
    const numAnswer = parseFloat(answer);
    const numStake = parseFloat(stake);
    
    if (isNaN(numAnswer)) {
      toast({ title: 'Invalid answer', description: 'Please enter a valid number.', variant: 'destructive' });
      return;
    }
    
    if (isNaN(numStake) || numStake <= 0) {
      toast({ title: 'Invalid stake', description: 'Stake must be a positive number.', variant: 'destructive' });
      return;
    }
    
    if (numStake > profile.currency) {
      toast({ title: 'Insufficient funds', description: `You only have ${profile.currency.toFixed(2)} currency.`, variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    try {
      // Lock stake from user's currency
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ currency: profile.currency - numStake })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Create solution
      const { data: solution, error: solutionError } = await supabase
        .from('solutions')
        .insert({
          problem_id: problem.id,
          submitter_id: profile.id,
          answer: numAnswer,
          stake: numStake,
        })
        .select(`
          *,
          submitter:profiles!solutions_submitter_id_fkey(id, username)
        `)
        .single();

      if (solutionError) throw solutionError;

      // Log transaction
      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'stake_lock',
        amount: -numStake,
        problem_id: problem.id,
        solution_id: solution.id,
        description: `Stake locked for problem: ${problem.title}`,
      });

      await refreshProfile();
      
      setUserSolution({
        ...solution,
        answer: Number(solution.answer),
        stake: Number(solution.stake),
        error: null,
        payout: null,
      });

      toast({
        title: 'Solution submitted!',
        description: `Stake of ${numStake} locked until deadline.`,
      });

      setAnswer('');
      setStake('');
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === '23505') {
        toast({ title: 'Already submitted', description: 'You have already submitted a solution.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Failed to submit solution.', variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 max-w-4xl">
          <Skeleton className="h-12 w-2/3 mb-4" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 text-center">
          <h1 className="font-serif text-2xl font-bold mb-4">Problem Not Found</h1>
          <Link to="/">
            <Button>Back to Problems</Button>
          </Link>
        </main>
      </div>
    );
  }

  const isExpired = isPast(new Date(problem.deadline));
  const showIntendedAnswer = isExpired || problem.status === 'evaluated';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8 max-w-4xl">
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {problem.status === 'invalidated' && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Invalidated
              </Badge>
            )}
            {problem.status === 'evaluated' && (
              <Badge className="bg-chart-1/20 text-chart-1">Evaluated</Badge>
            )}
            {problem.tags?.map((tag) => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
            {problem.difficulty && (
              <Badge variant="secondary">{problem.difficulty}</Badge>
            )}
          </div>
          
          <h1 className="font-serif text-3xl font-bold text-foreground mb-4">
            {problem.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <Link to={`/profile/${problem.creator.id}`} className="hover:text-primary">
                {problem.creator.username}
              </Link>
            </span>
            <span className="flex items-center gap-1">
              <Coins className="h-4 w-4 text-chart-1" />
              {problem.bounty.toFixed(2)} bounty
            </span>
            <span className={`flex items-center gap-1 ${isExpired ? 'text-destructive' : ''}`}>
              <Clock className="h-4 w-4" />
              {new Date(problem.deadline).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Problem Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <LatexRenderer content={problem.description} />
            </div>
            {problem.units && (
              <p className="mt-4 text-sm text-muted-foreground">
                <strong>Units:</strong> {problem.units}
              </p>
            )}
          </CardContent>
        </Card>

        {showIntendedAnswer && (
          <Card className="mb-8 border-chart-1/30 bg-chart-1/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-chart-1" />
                Intended Answer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-bold">
                {problem.intended_answer}
                {problem.units && <span className="text-muted-foreground ml-2 text-lg">{problem.units}</span>}
              </p>
            </CardContent>
          </Card>
        )}

        {!isExpired && profile && !userSolution && problem.status === 'open' && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Submit Your Solution</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitSolution} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="answer">Your Answer (numerical)</Label>
                    <Input
                      id="answer"
                      type="number"
                      step="any"
                      placeholder="Enter your numerical answer"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stake">Confidence Stake</Label>
                    <Input
                      id="stake"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="How much to stake"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Available: {profile.currency.toFixed(2)}
                    </p>
                  </div>
                </div>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Solution'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {userSolution && !isExpired && (
          <Card className="mb-8 border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle>Your Submission</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Answer: <span className="font-mono font-bold text-foreground">{userSolution.answer}</span>
              </p>
              <p className="text-muted-foreground">
                Stake: <span className="font-mono font-bold text-foreground">{userSolution.stake.toFixed(2)}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Results will be visible after the deadline.
              </p>
            </CardContent>
          </Card>
        )}

        {isExpired && solutions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Results ({solutions.length} solutions)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Answer</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Stake</TableHead>
                    <TableHead>Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solutions.map((sol, idx) => (
                    <TableRow key={sol.id} className={sol.submitter.id === profile?.id ? 'bg-primary/5' : ''}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell>
                        <Link to={`/profile/${sol.submitter.id}`} className="hover:text-primary">
                          {sol.submitter.username}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono">{sol.answer}</TableCell>
                      <TableCell className="font-mono">
                        {sol.error !== null ? sol.error.toExponential(2) : '-'}
                      </TableCell>
                      <TableCell className="font-mono">{sol.stake.toFixed(2)}</TableCell>
                      <TableCell className={`font-mono font-bold ${
                        sol.payout !== null 
                          ? sol.payout >= 0 ? 'text-chart-1' : 'text-destructive'
                          : ''
                      }`}>
                        {sol.payout !== null ? (sol.payout >= 0 ? '+' : '') + sol.payout.toFixed(2) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {isExpired && solutions.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No solutions were submitted for this problem.
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
