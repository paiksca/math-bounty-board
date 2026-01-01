import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Coins } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  username: string;
  reputation: number;
  total_profit: number;
  currency: number;
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'reputation' | 'total_profit'>('reputation');

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy]);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, reputation, total_profit, currency')
      .order(sortBy, { ascending: false })
      .limit(100);

    if (!error && data) {
      setLeaders(data.map((p) => ({
        ...p,
        reputation: Number(p.reputation),
        total_profit: Number(p.total_profit),
        currency: Number(p.currency),
      })));
    }
    setLoading(false);
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500/20 text-yellow-600">🥇</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400/20 text-gray-600">🥈</Badge>;
    if (rank === 3) return <Badge className="bg-orange-500/20 text-orange-600">🥉</Badge>;
    return <span className="text-muted-foreground">{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-chart-1" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground">
            Top performers ranked by reputation and profit.
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSortBy('reputation')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sortBy === 'reputation'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="inline h-4 w-4 mr-1" />
            By Reputation
          </button>
          <button
            onClick={() => setSortBy('total_profit')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sortBy === 'total_profit'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Coins className="inline h-4 w-4 mr-1" />
            By Profit
          </button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top 100 Players</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Rank</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead className="text-right">Reputation</TableHead>
                    <TableHead className="text-right">Total Profit</TableHead>
                    <TableHead className="text-right">Currency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaders.map((leader, idx) => (
                    <TableRow key={leader.id}>
                      <TableCell>{getRankBadge(idx + 1)}</TableCell>
                      <TableCell>
                        <Link
                          to={`/profile/${leader.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {leader.username}
                        </Link>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${
                        leader.reputation >= 0 ? 'text-chart-1' : 'text-destructive'
                      }`}>
                        {leader.reputation >= 0 ? '+' : ''}{leader.reputation.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${
                        leader.total_profit >= 0 ? 'text-chart-1' : 'text-destructive'
                      }`}>
                        {leader.total_profit >= 0 ? '+' : ''}{leader.total_profit.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {leader.currency.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
