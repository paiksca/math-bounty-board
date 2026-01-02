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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Trophy, Calendar, TrendingUp, TrendingDown, Wallet, ExternalLink, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';
import { WalletConnection } from '@/components/WalletConnection';
import { useMNEEBalance } from '@/hooks/useMNEE';
import { TransactionHash } from '@/components/TransactionStatus';
import { getEtherscanAddressLink, MNEE_TO_CURRENCY_RATIO } from '@/lib/wagmi';

interface ProfileData {
  id: string;
  username: string;
  currency: number;
  reputation: number;
  total_profit: number;
  is_frozen: boolean;
  created_at: string;
  wallet_address: string | null;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  tx_hash: string | null;
  created_at: string;
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { address, isConnected } = useAccount();
  const { balanceFormatted, balanceAsCurrency } = useMNEEBalance();

  const isOwnProfile = authProfile?.id === id;

  const handleLinkWallet = async () => {
    if (!address || !id) return;

    setLinkingWallet(true);
    try {
      const { error } = await supabase.functions.invoke('mnee-payments', {
        body: { action: 'link_wallet', user_id: id, wallet_address: address }
      });

      if (error) throw error;

      toast.success('Wallet linked successfully!');
      setDialogOpen(false);
      fetchProfile();
    } catch (error) {
      console.error('Error linking wallet:', error);
      toast.error('Failed to link wallet. It may already be linked to another account.');
    } finally {
      setLinkingWallet(false);
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
        wallet_address: profileData.wallet_address || null,
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
          tx_hash: (t as { tx_hash?: string | null }).tx_hash ?? null,
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

  const shortWalletAddress = profile.wallet_address 
    ? `${profile.wallet_address.slice(0, 6)}...${profile.wallet_address.slice(-4)}`
    : null;

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
                
                {/* Wallet Address */}
                {profile.wallet_address ? (
                  <a 
                    href={getEtherscanAddressLink(profile.wallet_address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                  >
                    <Wallet className="h-4 w-4" />
                    {shortWalletAddress}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : isOwnProfile && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Wallet className="h-4 w-4" />
                    No wallet linked
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-4">
                {isOwnProfile && (
                  <div className="flex items-center gap-2">
                    {!profile.wallet_address && isConnected && (
                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Link2 className="h-4 w-4" />
                            Link Wallet
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Link Your Ethereum Wallet</DialogTitle>
                          </DialogHeader>
                          <div className="py-4 space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Link your connected wallet to receive MNEE payouts directly on-chain.
                            </p>
                            <div className="p-4 rounded-lg bg-muted">
                              <p className="text-sm text-muted-foreground mb-1">Connected Wallet:</p>
                              <p className="font-mono text-sm break-all">{address}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-muted">
                              <p className="text-sm text-muted-foreground mb-1">MNEE Balance:</p>
                              <p className="font-semibold">{balanceFormatted} MNEE</p>
                              <p className="text-xs text-muted-foreground">
                                ≈ {balanceAsCurrency.toFixed(2)} currency units
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button onClick={handleLinkWallet} disabled={linkingWallet}>
                              {linkingWallet ? 'Linking...' : 'Link Wallet'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    {!profile.wallet_address && !isConnected && (
                      <WalletConnection />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-6">
                  {/* MNEE Balance (if wallet connected) */}
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-mono text-xl font-bold">
                      {profile.wallet_address && isConnected ? balanceAsCurrency.toFixed(2) : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">MNEE Balance</p>
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

        {/* Info Card about MNEE */}
        {isOwnProfile && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">MNEE Payments Enabled</h3>
                  <p className="text-sm text-muted-foreground">
                    This platform uses MNEE (ERC-20 stablecoin on Sepolia Testnet) for all payments.
                    Connect your wallet to participate in bounties and receive payouts directly on-chain.
                    <br />
                    <span className="font-medium">Ratio: 1 MNEE = {MNEE_TO_CURRENCY_RATIO} currency units</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                    <TableHead>Tx Hash</TableHead>
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
                      <TableCell>
                        {tx.tx_hash ? (
                          <TransactionHash hash={tx.tx_hash} />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
