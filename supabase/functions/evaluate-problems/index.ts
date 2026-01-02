import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestInputsRange {
  min: number;
  max: number;
  count: number;
}

interface ExecutionResult {
  output: unknown;
  executionTimeMs: number;
  error?: string;
}

// Energy cost: 1 credit per millisecond of execution time
const ENERGY_COST_PER_MS = 1;

// Execute Python algorithm via AI simulation
async function executePython(algorithm: string, testInput: unknown): Promise<ExecutionResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const systemPrompt = `You are a Python code executor. Execute the provided Python code with the given test input.

CRITICAL RULES:
1. The code defines a function called 'solve' that takes one argument
2. The code may use any Python standard library imports (math, numpy, pandas, requests, etc.)
3. The code may make API calls to external services
4. Call solve(test_input) and return the result
5. Return ONLY valid JSON: {"output": <result>, "execution_time_ms": <simulated_time>}
6. If there's an error, return: {"error": "<error_message>", "execution_time_ms": 0}
7. Simulate realistic execution time based on code complexity and API calls (1-2000ms range)
8. For API calls, simulate network latency (100-500ms per call)
9. Do NOT include any explanation, just the JSON`;

  const userPrompt = `Test Input: ${JSON.stringify(testInput)}

Python Code:
\`\`\`python
${algorithm}
\`\`\`

Execute solve(${JSON.stringify(testInput)}) and return JSON result.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    return { output: null, executionTimeMs: 0, error: "AI execution failed" };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  try {
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();
    
    const parsed = JSON.parse(jsonStr);
    return {
      output: parsed.output,
      executionTimeMs: parsed.execution_time_ms || 50,
      error: parsed.error,
    };
  } catch {
    return { output: null, executionTimeMs: 0, error: "Failed to parse output" };
  }
}

// Execute cost function to calculate cost (returns cost and execution time)
async function calculateCost(costFunction: string, testInput: unknown, solutionOutput: unknown): Promise<{ cost: number; executionTimeMs: number; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const systemPrompt = `You are a Python code executor. Execute the cost function with the given inputs.

CRITICAL RULES:
1. The code defines a function called 'cost' that takes two arguments: (test_input, solution_output)
2. The code may use any Python standard library imports (math, numpy, pandas, requests, etc.)
3. The code may make API calls to external services (e.g., to fetch real-time data)
4. Call cost(test_input, solution_output) and return the result
5. Return ONLY valid JSON: {"cost": <number>, "execution_time_ms": <simulated_time>}
6. If there's an error, return: {"error": "<error_message>", "execution_time_ms": 0}
7. The cost should be a positive number (0 or greater)
8. Simulate realistic execution time based on code complexity and API calls (1-2000ms range)
9. For API calls, simulate network latency (100-500ms per call)`;

  const userPrompt = `Test Input: ${JSON.stringify(testInput)}
Solution Output: ${JSON.stringify(solutionOutput)}

Python Cost Function:
\`\`\`python
${costFunction}
\`\`\`

Execute cost(${JSON.stringify(testInput)}, ${JSON.stringify(solutionOutput)}) and return JSON with cost and execution_time_ms.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    return { cost: Infinity, executionTimeMs: 0, error: "Cost calculation failed" };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  try {
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();
    
    const parsed = JSON.parse(jsonStr);
    if (parsed.error) return { cost: Infinity, executionTimeMs: parsed.execution_time_ms || 0, error: parsed.error };
    return { cost: Number(parsed.cost), executionTimeMs: parsed.execution_time_ms || 50 };
  } catch {
    return { cost: Infinity, executionTimeMs: 0, error: "Failed to parse cost" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceKey);

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
      const bounty = Number(problem.bounty);
      const costFunction = problem.cost_function as string;
      const testInputsRange = problem.test_inputs_range as TestInputsRange;
      const timePenaltyPerMs = Number(problem.time_penalty_per_ms) || 0.001;

      // Generate random test input from range
      const testInput: number[] = [];
      for (let i = 0; i < (testInputsRange.count || 1); i++) {
        const val = testInputsRange.min + Math.random() * (testInputsRange.max - testInputsRange.min);
        testInput.push(Number(val.toFixed(4)));
      }

      console.log(`Evaluating problem ${problem.id} with test input:`, testInput);

      // Store the test input used
      await supabase
        .from("problems")
        .update({ test_input: testInput })
        .eq("id", problem.id);

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

      interface EvaluatedSolution {
        id: string;
        submitter_id: string;
        stake: number;
        output: unknown;
        cost: number;
        executionTimeMs: number;
        effectiveStake: number;
      }

      const evaluatedSolutions: EvaluatedSolution[] = [];

      // Execute each solution algorithm
      for (const sol of solutions) {
        const algorithm = sol.algorithm as string;
        const stake = Number(sol.stake);

        console.log(`Executing solution ${sol.id}...`);

        // Execute the solution algorithm
        const execResult = await executePython(algorithm, testInput);
        
        let cost = Infinity;
        let totalExecutionTimeMs = execResult.executionTimeMs;
        
        if (!execResult.error && execResult.output !== null) {
          // Calculate cost using the problem's cost function
          const costResult = await calculateCost(costFunction, testInput, execResult.output);
          totalExecutionTimeMs += costResult.executionTimeMs;
          if (!costResult.error) {
            cost = costResult.cost;
          }
        }

        // Energy cost = total execution time (solution + cost function) * 1 credit per ms
        const energyCost = totalExecutionTimeMs * ENERGY_COST_PER_MS;
        const effectiveStake = Math.max(0, stake - energyCost);

        evaluatedSolutions.push({
          id: sol.id,
          submitter_id: sol.submitter_id,
          stake,
          output: execResult.output,
          cost,
          executionTimeMs: totalExecutionTimeMs,
          effectiveStake,
        });

        // Update solution record
        await supabase
          .from("solutions")
          .update({
            output: execResult.output,
            cost,
            execution_time_ms: execResult.executionTimeMs,
          })
          .eq("id", sol.id);
      }

      // Calculate payouts: score = effectiveStake / cost
      const zeroCostSolutions = evaluatedSolutions.filter(s => s.cost === 0);
      
      let payouts: { id: string; submitter_id: string; stake: number; payout: number }[];

      if (zeroCostSolutions.length > 0) {
        // Split pool among zero-cost solutions based on effective stake
        const totalEffectiveStake = zeroCostSolutions.reduce((sum, s) => sum + s.effectiveStake, 0);
        payouts = evaluatedSolutions.map(s => {
          if (s.cost === 0) {
            const share = totalEffectiveStake > 0 ? s.effectiveStake / totalEffectiveStake : 1 / zeroCostSolutions.length;
            return { id: s.id, submitter_id: s.submitter_id, stake: s.stake, payout: pool * share };
          } else {
            return { id: s.id, submitter_id: s.submitter_id, stake: s.stake, payout: 0 };
          }
        });
      } else {
        // Score = effectiveStake / cost
        const scores = evaluatedSolutions.map(s => ({
          ...s,
          score: s.cost === Infinity || s.cost === 0 ? 0 : s.effectiveStake / s.cost,
        }));
        const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
        payouts = scores.map(s => ({
          id: s.id,
          submitter_id: s.submitter_id,
          stake: s.stake,
          payout: totalScore > 0 ? pool * (s.score / totalScore) : pool / scores.length,
        }));
      }

      // Distribute payouts
      for (const payout of payouts) {
        const netPayout = payout.payout - payout.stake;

        // Update solution with payout
        await supabase
          .from("solutions")
          .update({ payout: netPayout })
          .eq("id", payout.id);

        // Update user currency and reputation
        const { data: profile } = await supabase
          .from("profiles")
          .select("currency, reputation, total_profit")
          .eq("id", payout.submitter_id)
          .single();

        if (profile) {
          const reputationChange = netPayout * 0.1;
          await supabase
            .from("profiles")
            .update({
              currency: Number(profile.currency) + payout.payout,
              reputation: Number(profile.reputation) + reputationChange,
              total_profit: Number(profile.total_profit) + netPayout,
            })
            .eq("id", payout.submitter_id);

          await supabase.from("transactions").insert({
            user_id: payout.submitter_id,
            type: "payout",
            amount: payout.payout,
            problem_id: problem.id,
            solution_id: payout.id,
            description: `Payout for problem: ${problem.title}`,
          });
        }
      }

      await supabase.from("problems").update({ status: "evaluated" }).eq("id", problem.id);
      console.log(`Problem ${problem.id} evaluated successfully`);
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
