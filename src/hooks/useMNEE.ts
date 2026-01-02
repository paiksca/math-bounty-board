import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { MNEE_CONTRACT_ADDRESS, ERC20_ABI, formatMnee, currencyToMnee, mneeToCurrency } from '@/lib/wagmi';

export function useMNEEBalance() {
  const { address } = useAccount();
  
  const { data: balance, isLoading, refetch } = useReadContract({
    address: MNEE_CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const balanceBigInt = balance as bigint | undefined;

  return {
    balance: balanceBigInt ?? BigInt(0),
    balanceFormatted: balanceBigInt ? formatMnee(balanceBigInt) : '0',
    balanceAsCurrency: balanceBigInt ? mneeToCurrency(balanceBigInt) : 0,
    isLoading,
    refetch,
  };
}

export function useMNEEAllowance(spenderAddress: `0x${string}` | undefined) {
  const { address } = useAccount();
  
  const { data: allowance, isLoading, refetch } = useReadContract({
    address: MNEE_CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && spenderAddress ? [address, spenderAddress] : undefined,
    query: {
      enabled: !!address && !!spenderAddress,
    },
  });

  const allowanceBigInt = allowance as bigint | undefined;

  return {
    allowance: allowanceBigInt ?? BigInt(0),
    isLoading,
    refetch,
  };
}

export function useMNEETransfer() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const transfer = (toAddress: `0x${string}`, currencyAmount: number) => {
    const mneeAmount = currencyToMnee(currencyAmount);
    
    writeContract({
      address: MNEE_CONTRACT_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [toAddress, mneeAmount],
      chain: sepolia,
      account: address,
    });
  };

  return {
    transfer,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useMNEEApprove() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = (spenderAddress: `0x${string}`, currencyAmount: number) => {
    const mneeAmount = currencyToMnee(currencyAmount);
    
    writeContract({
      address: MNEE_CONTRACT_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spenderAddress, mneeAmount],
      chain: sepolia,
      account: address,
    });
  };

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
