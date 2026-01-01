import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { ProblemCard } from '@/components/ProblemCard';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Archive } from 'lucide-react';

interface Problem {
  id: string;
  title: string;
  description: string;
  bounty: number;
  deadline: string;
  status: string;
  tags: string[];
  difficulty: string | null;
  creator: {
    username: string;
  };
  solution_count: number;
}

export default function PastProblems() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProblems();
  }, []);

  const fetchProblems = async () => {
    const { data, error } = await supabase
      .from('problems')
      .select(`
        *,
        creator:profiles!problems_creator_id_fkey(username),
        solutions(count)
      `)
      .or(`status.eq.evaluated,status.eq.invalidated,deadline.lt.${new Date().toISOString()}`)
      .order('deadline', { ascending: false });

    if (!error && data) {
      const formatted = data.map((p) => ({
        ...p,
        bounty: Number(p.bounty),
        creator: p.creator,
        solution_count: p.solutions?.[0]?.count || 0,
      }));
      setProblems(formatted);
    }
    setLoading(false);
  };

  const filteredProblems = problems.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
            Past Problems
          </h1>
          <p className="text-muted-foreground">
            View evaluated problems, intended answers, and solution results.
          </p>
        </div>

        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search past problems..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="text-center py-16">
            <Archive className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-serif text-lg font-semibold mb-2">No Past Problems</h3>
            <p className="text-muted-foreground">
              Evaluated problems will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProblems.map((problem) => (
              <ProblemCard key={problem.id} problem={problem} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
