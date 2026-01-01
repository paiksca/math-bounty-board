-- Add 'deposit' to the allowed transaction types
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
  CHECK (type = ANY (ARRAY['stake_lock', 'stake_return', 'bounty_lock', 'bounty_return', 'payout', 'reputation_change', 'admin_adjustment', 'deposit']::text[]));