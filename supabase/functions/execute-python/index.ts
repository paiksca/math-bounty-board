import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExecutionRequest {
  algorithm: string;
  testInput: unknown;
}

interface ExecutionResult {
  output: unknown;
  executionTimeMs: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { algorithm, testInput }: ExecutionRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Executing Python algorithm with test input:", JSON.stringify(testInput));

    const systemPrompt = `You are a Python code executor. You will be given Python code and a test input.
Execute the code with the given input and return ONLY the result in JSON format.

CRITICAL RULES:
1. Execute the provided Python code with the test_input variable available
2. The code should define a function called 'solve' that takes one argument
3. The code may use any Python standard library imports (math, numpy, pandas, requests, json, etc.)
4. The code may make API calls to external services (simulate realistic responses)
5. Call solve(test_input) and return the result
6. Return ONLY valid JSON: {"output": <result>, "execution_time_ms": <simulated_time>}
7. If there's an error, return: {"error": "<error_message>"}
8. Simulate realistic execution time based on code complexity (1-2000ms range)
9. For API calls, simulate network latency (100-500ms per call)
10. Do NOT include any explanation, just the JSON result`;

    const userPrompt = `Test Input:
${JSON.stringify(testInput)}

Python Code:
\`\`\`python
${algorithm}
\`\`\`

Execute solve(test_input) where test_input = ${JSON.stringify(testInput)} and return the result as JSON.`;

    const startTime = Date.now();

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

    const apiTime = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI execution failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", content);

    // Parse the JSON response from AI
    let result: ExecutionResult;
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      
      const parsed = JSON.parse(jsonStr);
      
      if (parsed.error) {
        result = {
          output: null,
          executionTimeMs: parsed.execution_time_ms || apiTime,
          error: parsed.error,
        };
      } else {
        result = {
          output: parsed.output,
          executionTimeMs: parsed.execution_time_ms || Math.min(apiTime, 100),
        };
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      result = {
        output: null,
        executionTimeMs: apiTime,
        error: "Failed to parse algorithm output",
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Execution error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message, output: null, executionTimeMs: 0 }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
