import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find problems past deadline that need evaluation
    const { data: problems } = await supabase
      .from("problems")
      .select("*, solutions(*)")
      .eq("status", "open")
      .lt("deadline", new Date().toISOString());

    if (!problems || problems.length === 0) {
      return new Response(JSON.stringify({ message: "No problems to evaluate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const problem of problems) {
      const solutions = problem.solutions || [];
      const intendedAnswer = Number(problem.intended_answer);
      const bounty = Number(problem.bounty);

      if (solutions.length === 0) {
        // Return bounty to creator
        const { data: creator } = await supabase
          .from("profiles")
          .select("currency")
          .eq("id", problem.creator_id)
          .single();

        if (creator) {
          await supabase
            .from("profiles")
            .update({ currency: Number(creator.currency) + bounty })
            .eq("id", problem.creator_id);

          await supabase.from("transactions").insert({
            user_id: problem.creator_id,
            type: "bounty_return",
            amount: bounty,
            problem_id: problem.id,
            description: "Bounty returned - no solutions submitted",
          });
        }

        await supabase.from("problems").update({ status: "evaluated" }).eq("id", problem.id);
        continue;
      }

      // Calculate total pool (bounty + all stakes)
      const totalStake = solutions.reduce((sum: number, s: { stake: number }) => sum + Number(s.stake), 0);
      const pool = bounty + totalStake;

      interface ScoredSolution {
        id: string;
        submitter_id: string;
        answer: number;
        stake: number;
        error: number;
      }

      // Calculate MSE for each solution
      const scored: ScoredSolution[] = solutions.map((s: { id: string; submitter_id: string; answer: number; stake: number }) => {
        const answer = Number(s.answer);
        const stake = Number(s.stake);
        const squaredError = Math.pow(answer - intendedAnswer, 2);
        return { id: s.id, submitter_id: s.submitter_id, answer, stake, error: squaredError };
      });

      // Check if anyone has zero error
      const zeroErrorSolutions = scored.filter((s: ScoredSolution) => s.error === 0);
      
      interface PayoutResult {
        id: string;
        submitter_id: string;
        error: number;
        stake: number;
        payout: number;
      }
      
      let payoutResults: PayoutResult[];
      
      if (zeroErrorSolutions.length > 0) {
        // Split pool among zero-error solutions based on stake
        const zeroErrorTotalStake = zeroErrorSolutions.reduce((sum: number, s: ScoredSolution) => sum + s.stake, 0);
        payoutResults = scored.map((s: ScoredSolution) => {
          if (s.error === 0) {
            const share = zeroErrorTotalStake > 0 ? s.stake / zeroErrorTotalStake : 1 / zeroErrorSolutions.length;
            return { id: s.id, submitter_id: s.submitter_id, error: s.error, stake: s.stake, payout: pool * share };
          } else {
            return { id: s.id, submitter_id: s.submitter_id, error: s.error, stake: s.stake, payout: 0 };
          }
        });
      } else {
        // Score = stake / MSE (higher stake, lower error = higher score)
        const scoresWithInverse = scored.map((s: ScoredSolution) => ({
          ...s,
          score: s.stake / s.error
        }));
        const totalScore = scoresWithInverse.reduce((sum: number, s: { score: number }) => sum + s.score, 0);
        payoutResults = scoresWithInverse.map((s) => ({
          id: s.id,
          submitter_id: s.submitter_id,
          error: s.error,
          stake: s.stake,
          payout: totalScore > 0 ? pool * (s.score / totalScore) : pool / scored.length
        }));
      }

      // Distribute payouts
      for (const sol of payoutResults) {
        const netPayout = sol.payout - sol.stake; // Net gain/loss

        // Update solution with error and payout
        await supabase
          .from("solutions")
          .update({ error: sol.error, payout: netPayout })
          .eq("id", sol.id);

        // Update user currency and reputation
        const { data: profile } = await supabase
          .from("profiles")
          .select("currency, reputation, total_profit")
          .eq("id", sol.submitter_id)
          .single();

        if (profile) {
          const reputationChange = netPayout * 0.1; // 10% of net payout affects reputation
          await supabase
            .from("profiles")
            .update({
              currency: Number(profile.currency) + sol.payout,
              reputation: Number(profile.reputation) + reputationChange,
              total_profit: Number(profile.total_profit) + netPayout,
            })
            .eq("id", sol.submitter_id);

          await supabase.from("transactions").insert({
            user_id: sol.submitter_id,
            type: "payout",
            amount: sol.payout,
            problem_id: problem.id,
            solution_id: sol.id,
            description: `Payout for problem: ${problem.title}`,
          });
        }
      }

      await supabase.from("problems").update({ status: "evaluated" }).eq("id", problem.id);
    }

    return new Response(JSON.stringify({ evaluated: problems.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Evaluation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
