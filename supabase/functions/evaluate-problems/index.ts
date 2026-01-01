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

      // Calculate errors and scores
      const totalStake = solutions.reduce((sum: number, s: { stake: number }) => sum + Number(s.stake), 0);
      const pool = bounty + totalStake;

      const scored = solutions.map((s: { id: string; submitter_id: string; answer: number; stake: number }) => {
        const answer = Number(s.answer);
        const stake = Number(s.stake);
        const error = Math.abs(answer - intendedAnswer);
        const relativeError = intendedAnswer !== 0 ? error / Math.abs(intendedAnswer) : error;
        // Score: inverse of relative error, weighted by stake
        const accuracy = 1 / (1 + relativeError);
        const score = accuracy * stake;
        return { ...s, error: relativeError, score, stake };
      });

      const totalScore = scored.reduce((sum: number, s: { score: number }) => sum + s.score, 0);

      // Distribute payouts
      for (const sol of scored) {
        const share = totalScore > 0 ? sol.score / totalScore : 1 / solutions.length;
        const payout = pool * share;
        const netPayout = payout - sol.stake; // Net gain/loss

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
              currency: Number(profile.currency) + payout,
              reputation: Number(profile.reputation) + reputationChange,
              total_profit: Number(profile.total_profit) + netPayout,
            })
            .eq("id", sol.submitter_id);

          await supabase.from("transactions").insert({
            user_id: sol.submitter_id,
            type: "payout",
            amount: payout,
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
  } catch (error) {
    console.error("Evaluation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
