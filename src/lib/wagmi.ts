import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected, walletConnect } from '@wagmi/connectors';

// MNEE Token Contract on Ethereum (we'll use same address on Sepolia for demo)
export const MNEE_CONTRACT_ADDRESS = '0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF' as const;

// MNEE to internal currency ratio (1 MNEE = 100 internal currency units)
export const MNEE_TO_CURRENCY_RATIO = 100;

// ERC-20 ABI for MNEE token
export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_from', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
] as const;

// WalletConnect Project ID - for production, get one from https://cloud.walletconnect.com
const WALLETCONNECT_PROJECT_ID = 'demo-project-id';

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),
    walletConnect({ projectId: WALLETCONNECT_PROJECT_ID }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
});

// Helper to convert internal currency to MNEE (with 18 decimals)
export function currencyToMnee(currencyAmount: number): bigint {
  const mneeAmount = currencyAmount / MNEE_TO_CURRENCY_RATIO;
  return BigInt(Math.floor(mneeAmount * 1e18));
}

// Helper to convert MNEE (with 18 decimals) to internal currency
export function mneeToCurrency(mneeWei: bigint): number {
  const mneeAmount = Number(mneeWei) / 1e18;
  return mneeAmount * MNEE_TO_CURRENCY_RATIO;
}

// Format MNEE for display
export function formatMnee(mneeWei: bigint): string {
  const mneeAmount = Number(mneeWei) / 1e18;
  return mneeAmount.toFixed(6);
}

// Get Etherscan link for transaction
export function getEtherscanTxLink(txHash: string): string {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

// Get Etherscan link for address
export function getEtherscanAddressLink(address: string): string {
  return `https://sepolia.etherscan.io/address/${address}`;
}
