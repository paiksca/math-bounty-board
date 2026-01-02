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

export function WalletConnection() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { balanceFormatted, balanceAsCurrency, isLoading: balanceLoading } = useMNEEBalance();

  const isWrongNetwork = isConnected && chainId !== sepolia.id;

  if (!isConnected) {
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
          {connectors.map((connector) => (
            <DropdownMenuItem
              key={connector.uid}
              onClick={() => connect({ connector })}
            >
              {connector.name}
            </DropdownMenuItem>
          ))}
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
