import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Coins, Trophy, Calendar, TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ProfileData {
  id: string;
  username: string;
  currency: number;
  reputation: number;
  total_profit: number;
  is_frozen: boolean;
  created_at: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMoneyAmount, setAddMoneyAmount] = useState('');
  const [addingMoney, setAddingMoney] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isOwnProfile = authProfile?.id === id;

  const handleAddMoney = async () => {
    const amount = parseFloat(addMoneyAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    setAddingMoney(true);
    try {
      // Update currency
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ currency: (profile?.currency || 0) + amount })
        .eq('id', id);

      if (updateError) throw updateError;

      // Record transaction
      await supabase.from('transactions').insert({
        user_id: id,
        type: 'deposit',
        amount: amount,
        description: 'Added funds to account',
      });

      toast.success(`Added ${amount.toFixed(2)} to your account`);
      setAddMoneyAmount('');
      setDialogOpen(false);
      fetchProfile(); // Refresh data
    } catch (error) {
      console.error('Error adding money:', error);
      toast.error('Failed to add money');
    } finally {
      setAddingMoney(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchProfile();
    }
  }, [id]);

  const fetchProfile = async () => {
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && profileData) {
      setProfile({
        ...profileData,
        currency: Number(profileData.currency),
        reputation: Number(profileData.reputation),
        total_profit: Number(profileData.total_profit),
      });

      // Fetch transactions for this user
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txData) {
        setTransactions(txData.map((t) => ({
          ...t,
          amount: Number(t.amount),
        })));
      }
    }
    setLoading(false);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      stake_lock: 'Stake Locked',
      stake_return: 'Stake Returned',
      bounty_lock: 'Bounty Locked',
      bounty_return: 'Bounty Returned',
      payout: 'Payout',
      reputation_change: 'Reputation',
      admin_adjustment: 'Admin Adjustment',
      deposit: 'Deposit',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <Skeleton className="h-48 w-full mb-8" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 text-center">
          <h1 className="font-serif text-2xl font-bold mb-4">User Not Found</h1>
          <Link to="/" className="text-primary hover:underline">
            Back to Problems
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="font-serif text-3xl font-bold">
                  {profile.username[0].toUpperCase()}
                </span>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="font-serif text-2xl font-bold">{profile.username}</h1>
                  {profile.is_frozen && (
                    <Badge variant="destructive">Frozen</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {format(new Date(profile.created_at), 'MMMM yyyy')}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {isOwnProfile && (
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Plus className="h-4 w-4" />
                        Add Money
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Money to Account</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <Input
                          type="number"
                          placeholder="Amount to add"
                          value={addMoneyAmount}
                          onChange={(e) => setAddMoneyAmount(e.target.value)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleAddMoney} disabled={addingMoney}>
                          {addingMoney ? 'Adding...' : 'Add Money'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Coins className="h-5 w-5 text-chart-1" />
                    </div>
                    <p className="font-mono text-xl font-bold">{profile.currency.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Currency</p>
                  </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Trophy className="h-5 w-5 text-chart-2" />
                  </div>
                  <p className={`font-mono text-xl font-bold ${
                    profile.reputation >= 0 ? 'text-chart-1' : 'text-destructive'
                  }`}>
                    {profile.reputation >= 0 ? '+' : ''}{profile.reputation.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Reputation</p>
                </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {profile.total_profit >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-chart-1" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <p className={`font-mono text-xl font-bold ${
                      profile.total_profit >= 0 ? 'text-chart-1' : 'text-destructive'
                    }`}>
                      {profile.total_profit >= 0 ? '+' : ''}{profile.total_profit.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Profit</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No transactions yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(tx.type)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {tx.description || '-'}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-medium ${
                        tx.amount >= 0 ? 'text-chart-1' : 'text-destructive'
                      }`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {format(new Date(tx.created_at), 'PP')}
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
