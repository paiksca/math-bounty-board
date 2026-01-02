import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationRequest {
  code: string;
  codeType: "cost_function" | "test_input_generator" | "algorithm";
}

type Severity = "safe" | "warning" | "dangerous";

interface ValidationResult {
  isValid: boolean;
  issues: string[];
  severity: Severity;
}

interface DangerousPattern {
  pattern: RegExp;
  issue: string;
  severity: Severity;
}

// Static analysis patterns for dangerous code
const DANGEROUS_PATTERNS: DangerousPattern[] = [
  { pattern: /import\s+os\b/i, issue: "Importing 'os' module can access system resources", severity: "dangerous" },
  { pattern: /import\s+subprocess\b/i, issue: "Importing 'subprocess' can execute system commands", severity: "dangerous" },
  { pattern: /import\s+sys\b/i, issue: "Importing 'sys' can access system internals", severity: "warning" },
  { pattern: /import\s+shutil\b/i, issue: "Importing 'shutil' can manipulate files", severity: "dangerous" },
  { pattern: /from\s+os\s+import/i, issue: "Importing from 'os' can access system resources", severity: "dangerous" },
  { pattern: /from\s+subprocess\s+import/i, issue: "Importing from 'subprocess' can execute system commands", severity: "dangerous" },
  { pattern: /\bopen\s*\(/i, issue: "File operations with 'open()' are not allowed", severity: "dangerous" },
  { pattern: /\bexec\s*\(/i, issue: "Dynamic code execution with 'exec()' is dangerous", severity: "dangerous" },
  { pattern: /\beval\s*\(/i, issue: "Dynamic code execution with 'eval()' is dangerous", severity: "dangerous" },
  { pattern: /\bcompile\s*\(/i, issue: "Dynamic code compilation is dangerous", severity: "dangerous" },
  { pattern: /__import__\s*\(/i, issue: "Dynamic imports with '__import__' are dangerous", severity: "dangerous" },
  { pattern: /\bgetattr\s*\(\s*__builtins__/i, issue: "Accessing builtins dynamically is dangerous", severity: "dangerous" },
  { pattern: /import\s+socket\b/i, issue: "Direct socket access is not allowed", severity: "dangerous" },
  { pattern: /import\s+ctypes\b/i, issue: "ctypes can access low-level memory", severity: "dangerous" },
  { pattern: /import\s+pickle\b/i, issue: "pickle can execute arbitrary code during deserialization", severity: "warning" },
  { pattern: /while\s+True\s*:/i, issue: "Infinite loop detected - ensure there's a break condition", severity: "warning" },
  { pattern: /\[\s*\]\s*\*\s*\d{7,}/i, issue: "Large memory allocation detected", severity: "warning" },
  { pattern: /range\s*\(\s*\d{9,}\s*\)/i, issue: "Extremely large range could cause memory issues", severity: "warning" },
];

// Allowed imports for safe execution
const ALLOWED_IMPORTS = [
  "math", "random", "statistics", "collections", "itertools", "functools",
  "json", "re", "datetime", "time", "decimal", "fractions",
  "numpy", "pandas", "scipy", "sklearn", "requests"
];

function staticAnalysis(code: string): { issues: string[]; severity: Severity } {
  const issues: string[] = [];
  let hasDangerous = false;
  let hasWarning = false;

  for (const { pattern, issue, severity } of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      issues.push(issue);
      if (severity === "dangerous") {
        hasDangerous = true;
      } else if (severity === "warning") {
        hasWarning = true;
      }
    }
  }

  const severity: Severity = hasDangerous ? "dangerous" : hasWarning ? "warning" : "safe";
  return { issues, severity };
}

function combineSeverity(a: Severity, b: Severity): Severity {
  if (a === "dangerous" || b === "dangerous") return "dangerous";
  if (a === "warning" || b === "warning") return "warning";
  return "safe";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, codeType }: ValidationRequest = await req.json();

    if (!code || !codeType) {
      return new Response(
        JSON.stringify({ isValid: false, issues: ["Code and codeType are required"], severity: "dangerous" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First, run static analysis
    const staticResult = staticAnalysis(code);
    
    // If static analysis finds dangerous patterns, reject immediately
    if (staticResult.severity === "dangerous") {
      return new Response(
        JSON.stringify({
          isValid: false,
          issues: staticResult.issues,
          severity: "dangerous",
        } as ValidationResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use AI for deeper semantic analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      // If no API key, rely on static analysis only
      return new Response(
        JSON.stringify({
          isValid: true,
          issues: staticResult.issues,
          severity: staticResult.severity,
        } as ValidationResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const codeTypeDescription = {
      cost_function: "a cost function that evaluates solution quality (takes test_input and solution_output, returns a number)",
      test_input_generator: "a test input generator that creates test data (uses fetch_stock, fetch_crypto, fetch_weather, or fetch_random)",
      algorithm: "a solution algorithm that solves a problem (takes test_input, returns a solution)",
    };

    const systemPrompt = `You are a Python code security analyzer. Analyze the provided code for security issues.

The code should be ${codeTypeDescription[codeType]}.

Check for these issues:
1. Malicious intent (data exfiltration, system access, resource exhaustion)
2. Infinite loops without proper termination
3. Excessive resource usage (memory, CPU)
4. Attempts to access external systems inappropriately
5. Code injection vulnerabilities
6. Logic that doesn't match the expected purpose

Allowed libraries: ${ALLOWED_IMPORTS.join(", ")}
Allowed built-in fetchers: fetch_stock, fetch_crypto, fetch_weather, fetch_random

Return ONLY valid JSON:
{
  "isValid": boolean,
  "issues": ["list of issues found"],
  "severity": "safe" | "warning" | "dangerous"
}

If the code is reasonable for its purpose and doesn't have security issues, return isValid: true with severity: "safe".
Only flag actual security concerns, not style issues.`;

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
          { role: "user", content: `Analyze this ${codeType}:\n\n\`\`\`python\n${code}\n\`\`\`` },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      // Fallback to static analysis if AI fails
      return new Response(
        JSON.stringify({
          isValid: true,
          issues: staticResult.issues,
          severity: staticResult.severity,
        } as ValidationResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
      jsonStr = jsonStr.trim();
      
      const aiResult = JSON.parse(jsonStr) as ValidationResult;
      
      // Combine static and AI analysis
      const combinedIssues = [...new Set([...staticResult.issues, ...aiResult.issues])];
      const combinedSeverity = combineSeverity(staticResult.severity, aiResult.severity);

      return new Response(
        JSON.stringify({
          isValid: combinedSeverity !== "dangerous",
          issues: combinedIssues,
          severity: combinedSeverity,
        } as ValidationResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch {
      // If parsing fails, use static analysis
      return new Response(
        JSON.stringify({
          isValid: true,
          issues: staticResult.issues,
          severity: staticResult.severity,
        } as ValidationResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Validation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ isValid: false, issues: [message], severity: "dangerous" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
