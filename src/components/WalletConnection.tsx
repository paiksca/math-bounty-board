import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, LogOut, AlertTriangle, ExternalLink } from 'lucide-react';
import { useMNEEBalance } from '@/hooks/useMNEE';
import { getEtherscanAddressLink, MNEE_TO_CURRENCY_RATIO } from '@/lib/wagmi';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

function getErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  const anyErr = err as any;
  return (
    anyErr?.shortMessage ||
    anyErr?.details ||
    anyErr?.message ||
    'Wallet connection failed'
  );
}

export function WalletConnection() {
  const { address, isConnected } = useAccount();
  const {
    connect,
    connectAsync,
    connectors,
    isPending,
    error: connectError,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { toast } = useToast();
  const { balanceFormatted, balanceAsCurrency, isLoading: balanceLoading } = useMNEEBalance();

  const isWrongNetwork = isConnected && chainId !== sepolia.id;

  const isEmbeddedPreview = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  useEffect(() => {
    if (!connectError) return;

    toast({
      title: 'Wallet connection failed',
      description: getErrorMessage(connectError),
      variant: 'destructive',
    });

    console.error('Wallet connect error:', connectError);
  }, [connectError, toast]);

  if (!isConnected) {
    // Filter to unique connectors by name to avoid duplicates
    const uniqueConnectors = connectors.filter(
      (connector, index, self) =>
        index === self.findIndex((c) => c.name === connector.name)
    );

    const externalHref = typeof window !== 'undefined' ? window.location.href : '/';

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            <Wallet className="h-4 w-4 mr-2" />
            {isPending ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Select Wallet</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isEmbeddedPreview && (
            <>
              <DropdownMenuItem asChild className="cursor-pointer">
                <a href={externalHref} target="_blank" rel="noopener noreferrer">
                  Open in new tab (recommended)
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {uniqueConnectors.length === 0 ? (
            <DropdownMenuItem disabled>No wallets detected</DropdownMenuItem>
          ) : (
            uniqueConnectors.map((connector) => {
              const isReady = (connector as any)?.ready ?? true;

              return (
                <DropdownMenuItem
                  key={connector.uid}
                  disabled={!isReady}
                  onSelect={async (e) => {
                    e.preventDefault();
                    try {
                      toast({
                        title: 'Opening wallet…',
                        description: `Connecting with ${connector.name}.`,
                      });
                      await connectAsync({ connector });
                    } catch (err) {
                      toast({
                        title: 'Wallet connection failed',
                        description: getErrorMessage(err),
                        variant: 'destructive',
                      });
                      console.error('Wallet connect error (select):', err);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {connector.name}
                  {!isReady ? ' (not detected)' : ''}
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (isWrongNetwork) {
    return (
      <Button 
        variant="destructive" 
        size="sm"
        onClick={() => switchChain({ chainId: sepolia.id })}
      >
        <AlertTriangle className="h-4 w-4 mr-2" />
        Switch to Sepolia
      </Button>
    );
  }

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline">{shortAddress}</span>
          <Badge variant="secondary" className="ml-1">
            {balanceLoading ? '...' : `${balanceFormatted} MNEE`}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Wallet Connected</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2">
          <p className="text-sm text-muted-foreground">Address</p>
          <p className="font-mono text-xs break-all">{address}</p>
        </div>
        <div className="px-2 py-2">
          <p className="text-sm text-muted-foreground">MNEE Balance</p>
          <p className="font-semibold">{balanceFormatted} MNEE</p>
          <p className="text-xs text-muted-foreground">
            ≈ {balanceAsCurrency.toFixed(2)} currency units (1 MNEE = {MNEE_TO_CURRENCY_RATIO} units)
          </p>
        </div>
        <div className="px-2 py-2">
          <p className="text-sm text-muted-foreground">Network</p>
          <Badge variant="outline">Sepolia Testnet</Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a 
            href={getEtherscanAddressLink(address || '')} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View on Etherscan
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => disconnect()} className="text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
