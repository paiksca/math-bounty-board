import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, FileText, Ban, RotateCcw, XCircle } from 'lucide-react';

interface UserData {
  id: string;
  user_id: string;
  username: string;
  currency: number;
  reputation: number;
  is_frozen: boolean;
}

interface ProblemData {
  id: string;
  title: string;
  status: string;
  bounty: number;
  deadline: string;
  creator: { username: string };
}

export default function Admin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserData[]>([]);
  const [problems, setProblems] = useState<ProblemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState('');
  const [searchProblem, setSearchProblem] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    const [usersRes, problemsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('problems').select('*, creator:profiles!problems_creator_id_fkey(username)').order('created_at', { ascending: false }),
    ]);

    if (usersRes.data) {
      setUsers(usersRes.data.map((u) => ({
        ...u,
        currency: Number(u.currency),
        reputation: Number(u.reputation),
      })));
    }
    if (problemsRes.data) {
      setProblems(problemsRes.data.map((p) => ({
        ...p,
        bounty: Number(p.bounty),
      })));
    }
    setLoading(false);
  };

  const toggleFreezeUser = async (user: UserData) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_frozen: !user.is_frozen })
      .eq('id', user.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update user.', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `User ${user.is_frozen ? 'unfrozen' : 'frozen'}.` });
      fetchData();
    }
  };

  const invalidateProblem = async (problem: ProblemData) => {
    // Return bounty to creator and stakes to solvers
    const { data: fullProblem } = await supabase
      .from('problems')
      .select('*, creator:profiles!problems_creator_id_fkey(*), solutions(*)')
      .eq('id', problem.id)
      .single();

    if (!fullProblem) return;

    // Return bounty
    await supabase
      .from('profiles')
      .update({ currency: Number(fullProblem.creator.currency) + Number(fullProblem.bounty) })
      .eq('id', fullProblem.creator.id);

    await supabase.from('transactions').insert({
      user_id: fullProblem.creator.id,
      type: 'bounty_return',
      amount: Number(fullProblem.bounty),
      problem_id: problem.id,
      description: 'Bounty returned - problem invalidated',
    });

    // Return stakes to all solvers
    for (const sol of fullProblem.solutions || []) {
      const { data: solver } = await supabase
        .from('profiles')
        .select('currency')
        .eq('id', sol.submitter_id)
        .single();

      if (solver) {
        await supabase
          .from('profiles')
          .update({ currency: Number(solver.currency) + Number(sol.stake) })
          .eq('id', sol.submitter_id);

        await supabase.from('transactions').insert({
          user_id: sol.submitter_id,
          type: 'stake_return',
          amount: Number(sol.stake),
          problem_id: problem.id,
          solution_id: sol.id,
          description: 'Stake returned - problem invalidated',
        });
      }
    }

    // Mark problem as invalidated
    await supabase.from('problems').update({ status: 'invalidated' }).eq('id', problem.id);

    toast({ title: 'Problem invalidated', description: 'All funds have been returned.' });
    fetchData();
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchUser.toLowerCase())
  );

  const filteredProblems = problems.filter((p) =>
    p.title.toLowerCase().includes(searchProblem.toLowerCase())
  );

  if (authLoading || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Shield className="h-8 w-8 text-destructive" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground">
            Manage users, problems, and platform integrity.
          </p>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="problems" className="gap-2">
              <FileText className="h-4 w-4" />
              Problems
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>All Users ({users.length})</span>
                  <Input
                    placeholder="Search users..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    className="max-w-xs"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Reputation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell className="font-mono">{user.currency.toFixed(2)}</TableCell>
                        <TableCell className={`font-mono ${
                          user.reputation >= 0 ? 'text-chart-1' : 'text-destructive'
                        }`}>
                          {user.reputation.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {user.is_frozen ? (
                            <Badge variant="destructive">Frozen</Badge>
                          ) : (
                            <Badge variant="outline">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant={user.is_frozen ? 'outline' : 'destructive'}
                            size="sm"
                            onClick={() => toggleFreezeUser(user)}
                          >
                            {user.is_frozen ? (
                              <>
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Unfreeze
                              </>
                            ) : (
                              <>
                                <Ban className="h-4 w-4 mr-1" />
                                Freeze
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="problems">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>All Problems ({problems.length})</span>
                  <Input
                    placeholder="Search problems..."
                    value={searchProblem}
                    onChange={(e) => setSearchProblem(e.target.value)}
                    className="max-w-xs"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead>Bounty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProblems.map((problem) => (
                      <TableRow key={problem.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {problem.title}
                        </TableCell>
                        <TableCell>{problem.creator.username}</TableCell>
                        <TableCell className="font-mono">{problem.bounty.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            problem.status === 'invalidated' ? 'destructive' :
                            problem.status === 'evaluated' ? 'default' : 'outline'
                          }>
                            {problem.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {problem.status !== 'invalidated' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => invalidateProblem(problem)}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Invalidate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
