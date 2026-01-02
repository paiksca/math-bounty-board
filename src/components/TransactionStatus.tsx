import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getEtherscanTxLink } from '@/lib/wagmi';

interface TransactionStatusProps {
  hash?: string;
  isPending?: boolean;
  isConfirming?: boolean;
  isSuccess?: boolean;
  error?: Error | null;
  className?: string;
}

export function TransactionStatus({
  hash,
  isPending,
  isConfirming,
  isSuccess,
  error,
  className = '',
}: TransactionStatusProps) {
  if (error) {
    return (
      <div className={`flex items-center gap-2 text-destructive ${className}`}>
        <XCircle className="h-4 w-4" />
        <span className="text-sm">Transaction failed: {error.message.slice(0, 50)}...</span>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Waiting for wallet confirmation...</span>
      </div>
    );
  }

  if (isConfirming) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Transaction pending...</span>
        {hash && (
          <a
            href={getEtherscanTxLink(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }

  if (isSuccess && hash) {
    return (
      <div className={`flex items-center gap-2 text-green-600 ${className}`}>
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm">Payment Sent ✔</span>
        <span className="font-mono text-xs text-muted-foreground">
          Tx: {hash.slice(0, 10)}...
        </span>
        <a
          href={getEtherscanTxLink(hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline flex items-center gap-1 ml-2"
        >
          View on Etherscan <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return null;
}

// Compact version for transaction history
export function TransactionHash({ hash, className = '' }: { hash: string; className?: string }) {
  return (
    <a
      href={getEtherscanTxLink(hash)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-1 text-primary hover:underline font-mono text-xs ${className}`}
    >
      {hash.slice(0, 10)}...{hash.slice(-6)}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
