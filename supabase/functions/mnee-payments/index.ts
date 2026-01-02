import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MNEE Token Configuration
const MNEE_CONTRACT_ADDRESS = '0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF';
const MNEE_TO_CURRENCY_RATIO = 100; // 1 MNEE = 100 internal currency units

interface PaymentRecord {
  problem_id: string;
  solution_id?: string;
  from_address: string;
  to_address: string;
  tx_hash: string;
  amount_currency: number;
  type: 'bounty_deposit' | 'stake_deposit' | 'payout';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...data } = await req.json();

    console.log(`MNEE Payment Action: ${action}`, data);

    switch (action) {
      case 'verify_tx': {
        // Verify a transaction was successful on-chain
        // In production, you would call an Ethereum RPC to verify the tx
        const { tx_hash, expected_amount, from_address, to_address } = data;
        
        console.log(`Verifying transaction: ${tx_hash}`);
        
        // For demo purposes, we trust the frontend transaction
        // In production, query the blockchain to verify:
        // 1. Transaction exists and is confirmed
        // 2. Correct token contract
        // 3. Correct from/to addresses
        // 4. Correct amount
        
        return new Response(JSON.stringify({
          verified: true,
          tx_hash,
          message: 'Transaction verification simulated for demo'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'record_bounty_deposit': {
        // Record that a bounty was deposited via MNEE
        const { problem_id, tx_hash, amount_currency, from_address, user_id } = data;

        // Record the transaction with tx_hash
        const { error: txError } = await supabase.from('transactions').insert({
          user_id,
          type: 'bounty_lock',
          amount: -amount_currency,
          problem_id,
          tx_hash,
          description: `MNEE bounty deposited - Tx: ${tx_hash}`,
        });

        if (txError) throw txError;

        return new Response(JSON.stringify({
          success: true,
          message: 'Bounty deposit recorded'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'record_stake_deposit': {
        // Record that a stake was deposited via MNEE
        const { solution_id, problem_id, tx_hash, amount_currency, from_address, user_id } = data;

        const { error: txError } = await supabase.from('transactions').insert({
          user_id,
          type: 'stake_lock',
          amount: -amount_currency,
          problem_id,
          solution_id,
          tx_hash,
          description: `MNEE stake deposited - Tx: ${tx_hash}`,
        });

        if (txError) throw txError;

        return new Response(JSON.stringify({
          success: true,
          message: 'Stake deposit recorded'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'process_payout': {
        // AI/Agent-triggered payout processing
        // This would be called after problem evaluation to trigger MNEE payouts
        const { problem_id, payouts } = data;
        
        // payouts is array of { user_id, wallet_address, amount_currency }
        const payoutInstructions = [];
        
        for (const payout of payouts) {
          if (!payout.wallet_address) {
            console.warn(`User ${payout.user_id} has no wallet linked, skipping MNEE payout`);
            continue;
          }
          
          const mneeAmount = payout.amount_currency / MNEE_TO_CURRENCY_RATIO;
          
          payoutInstructions.push({
            to_address: payout.wallet_address,
            amount_mnee: mneeAmount,
            amount_currency: payout.amount_currency,
            user_id: payout.user_id,
          });
        }

        // In production, this would:
        // 1. Use a server-side wallet to send MNEE to each recipient
        // 2. Or create payout claims that users can redeem
        // For demo, we return the payout instructions for frontend processing
        
        return new Response(JSON.stringify({
          success: true,
          payoutInstructions,
          message: `Generated ${payoutInstructions.length} payout instructions`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'link_wallet': {
        // Link an Ethereum wallet address to a user profile
        const { user_id, wallet_address } = data;

        const { error } = await supabase
          .from('profiles')
          .update({ wallet_address })
          .eq('id', user_id);

        if (error) {
          if (error.code === '23505') {
            return new Response(JSON.stringify({
              success: false,
              error: 'This wallet is already linked to another account'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw error;
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Wallet linked successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_wallet_for_user': {
        // Get wallet address for a user (for sending payouts)
        const { user_id } = data;

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', user_id)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({
          wallet_address: profile?.wallet_address
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({
          error: `Unknown action: ${action}`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    const error = err as Error;
    console.error('MNEE Payment error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
