import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TransactionStatus } from '@/components/TransactionStatus';
import { useMNEETransfer, useMNEEBalance } from '@/hooks/useMNEE';
import { MNEE_TO_CURRENCY_RATIO, currencyToMnee, formatMnee } from '@/lib/wagmi';
import { AlertTriangle } from 'lucide-react';

interface MNEEPaymentProps {
  recipientAddress: `0x${string}`;
  currencyAmount: number;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
  buttonText?: string;
  disabled?: boolean;
  className?: string;
}

export function MNEEPayment({
  recipientAddress,
  currencyAmount,
  onSuccess,
  onError,
  buttonText = 'Pay with MNEE',
  disabled = false,
  className = '',
}: MNEEPaymentProps) {
  const { isConnected } = useAccount();
  const { balance, balanceAsCurrency, refetch: refetchBalance } = useMNEEBalance();
  const { transfer, hash, isPending, isConfirming, isSuccess, error } = useMNEETransfer();

  const mneeAmount = currencyToMnee(currencyAmount);
  const hasInsufficientBalance = balance < mneeAmount;

  useEffect(() => {
    if (isSuccess && hash) {
      refetchBalance();
      onSuccess?.(hash);
    }
  }, [isSuccess, hash, onSuccess, refetchBalance]);

  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  const handlePayment = () => {
    transfer(recipientAddress, currencyAmount);
  };

  if (!isConnected) {
    return (
      <div className={`p-4 rounded-lg bg-muted/50 text-center ${className}`}>
        <p className="text-sm text-muted-foreground">
          Connect your wallet to make payments with MNEE
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Amount:</span>
        <span className="font-mono font-medium">
          {currencyAmount.toFixed(2)} units = {formatMnee(mneeAmount)} MNEE
        </span>
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Your Balance:</span>
        <span className={`font-mono font-medium ${hasInsufficientBalance ? 'text-destructive' : ''}`}>
          {balanceAsCurrency.toFixed(2)} units
        </span>
      </div>

      {hasInsufficientBalance && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>Insufficient MNEE balance</span>
        </div>
      )}

      <Button
        onClick={handlePayment}
        disabled={disabled || isPending || isConfirming || hasInsufficientBalance}
        className="w-full"
      >
        {isPending || isConfirming ? 'Processing...' : buttonText}
      </Button>

      <TransactionStatus
        hash={hash}
        isPending={isPending}
        isConfirming={isConfirming}
        isSuccess={isSuccess}
        error={error}
      />
    </div>
  );
}

// Simpler inline payment button
interface MNEEPayButtonProps {
  recipientAddress: `0x${string}`;
  currencyAmount: number;
  onSuccess?: (txHash: string) => void;
  buttonText?: string;
  disabled?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function MNEEPayButton({
  recipientAddress,
  currencyAmount,
  onSuccess,
  buttonText = 'Pay',
  disabled = false,
  variant = 'default',
  size = 'default',
  className = '',
}: MNEEPayButtonProps) {
  const { isConnected } = useAccount();
  const { balance, refetch: refetchBalance } = useMNEEBalance();
  const { transfer, hash, isPending, isConfirming, isSuccess } = useMNEETransfer();

  const mneeAmount = currencyToMnee(currencyAmount);
  const hasInsufficientBalance = balance < mneeAmount;

  useEffect(() => {
    if (isSuccess && hash) {
      refetchBalance();
      onSuccess?.(hash);
    }
  }, [isSuccess, hash, onSuccess, refetchBalance]);

  const handlePayment = () => {
    transfer(recipientAddress, currencyAmount);
  };

  if (!isConnected) {
    return null;
  }

  return (
    <Button
      onClick={handlePayment}
      disabled={disabled || isPending || isConfirming || hasInsufficientBalance}
      variant={variant}
      size={size}
      className={className}
    >
      {isPending || isConfirming ? 'Processing...' : buttonText}
    </Button>
  );
}
