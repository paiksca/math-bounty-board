import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Trophy, User, LogOut, Shield, PlusCircle } from 'lucide-react';
import { WalletConnection } from '@/components/WalletConnection';
import { useMNEEBalance } from '@/hooks/useMNEE';
import { useAccount } from 'wagmi';
import { MNEE_TO_CURRENCY_RATIO } from '@/lib/wagmi';

export function Header() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const { isConnected } = useAccount();
  const { balanceAsCurrency } = useMNEEBalance();

  const navItems = [
    { path: '/', label: 'Open Problems' },
    { path: '/past', label: 'Past Problems' },
    { path: '/leaderboard', label: 'Leaderboard' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="font-mono text-lg font-bold text-primary-foreground">∑</span>
            </div>
            <span className="font-serif text-xl font-bold text-foreground">MathStake</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                  location.pathname === '/admin'
                    ? 'bg-destructive/10 text-destructive'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* Wallet Connection - Always visible */}
          <WalletConnection />

          {user && profile ? (
            <>
              <Link to="/create" className="hidden sm:block">
                <Button size="sm" className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  New Problem
                </Button>
              </Link>
              
              {/* Show MNEE-based balance when wallet connected */}
              {isConnected && (
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-1.5">
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-xs text-muted-foreground">Balance:</span>
                    <span className="font-mono font-medium">{balanceAsCurrency.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">units</span>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1 text-sm">
                    <Trophy className="h-4 w-4 text-chart-2" />
                    <span className={`font-mono font-medium ${profile.reputation >= 0 ? 'text-chart-1' : 'text-destructive'}`}>
                      {profile.reputation >= 0 ? '+' : ''}{profile.reputation.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}

              <Link
                to={`/profile/${profile.id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">{profile.username}</span>
              </Link>

              <Button variant="ghost" size="icon" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/auth">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
