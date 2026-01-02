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

// Comprehensive static analysis patterns for dangerous code
const DANGEROUS_PATTERNS: DangerousPattern[] = [
  // System access
  { pattern: /import\s+os\b/i, issue: "Importing 'os' module is forbidden - system access", severity: "dangerous" },
  { pattern: /from\s+os\s+import/i, issue: "Importing from 'os' is forbidden - system access", severity: "dangerous" },
  { pattern: /import\s+subprocess\b/i, issue: "Importing 'subprocess' is forbidden - command execution", severity: "dangerous" },
  { pattern: /from\s+subprocess\s+import/i, issue: "Importing from 'subprocess' is forbidden", severity: "dangerous" },
  { pattern: /import\s+sys\b/i, issue: "Importing 'sys' is forbidden - system internals access", severity: "dangerous" },
  { pattern: /from\s+sys\s+import/i, issue: "Importing from 'sys' is forbidden", severity: "dangerous" },
  { pattern: /import\s+shutil\b/i, issue: "Importing 'shutil' is forbidden - file manipulation", severity: "dangerous" },
  { pattern: /from\s+shutil\s+import/i, issue: "Importing from 'shutil' is forbidden", severity: "dangerous" },
  { pattern: /import\s+ctypes\b/i, issue: "Importing 'ctypes' is forbidden - low-level memory access", severity: "dangerous" },
  { pattern: /import\s+multiprocessing\b/i, issue: "Importing 'multiprocessing' is forbidden - process spawning", severity: "dangerous" },
  { pattern: /import\s+threading\b/i, issue: "Importing 'threading' is forbidden - thread spawning", severity: "dangerous" },
  { pattern: /import\s+signal\b/i, issue: "Importing 'signal' is forbidden - signal handling", severity: "dangerous" },
  { pattern: /import\s+pty\b/i, issue: "Importing 'pty' is forbidden - pseudo-terminal access", severity: "dangerous" },
  { pattern: /import\s+fcntl\b/i, issue: "Importing 'fcntl' is forbidden - file control", severity: "dangerous" },
  { pattern: /import\s+resource\b/i, issue: "Importing 'resource' is forbidden - resource limits manipulation", severity: "dangerous" },
  { pattern: /import\s+gc\b/i, issue: "Importing 'gc' is forbidden - garbage collector manipulation", severity: "dangerous" },
  { pattern: /import\s+code\b/i, issue: "Importing 'code' is forbidden - interactive interpreter", severity: "dangerous" },
  { pattern: /import\s+codeop\b/i, issue: "Importing 'codeop' is forbidden - code compilation", severity: "dangerous" },
  
  // Network access (data exfiltration risk)
  { pattern: /import\s+requests\b/i, issue: "Importing 'requests' is forbidden - network access/data exfiltration risk", severity: "dangerous" },
  { pattern: /from\s+requests\s+import/i, issue: "Importing from 'requests' is forbidden", severity: "dangerous" },
  { pattern: /import\s+urllib\b/i, issue: "Importing 'urllib' is forbidden - network access", severity: "dangerous" },
  { pattern: /from\s+urllib\s+import/i, issue: "Importing from 'urllib' is forbidden", severity: "dangerous" },
  { pattern: /import\s+http\b/i, issue: "Importing 'http' is forbidden - network access", severity: "dangerous" },
  { pattern: /from\s+http\s+import/i, issue: "Importing from 'http' is forbidden", severity: "dangerous" },
  { pattern: /import\s+socket\b/i, issue: "Importing 'socket' is forbidden - network access", severity: "dangerous" },
  { pattern: /from\s+socket\s+import/i, issue: "Importing from 'socket' is forbidden", severity: "dangerous" },
  { pattern: /import\s+ftplib\b/i, issue: "Importing 'ftplib' is forbidden - FTP access", severity: "dangerous" },
  { pattern: /import\s+smtplib\b/i, issue: "Importing 'smtplib' is forbidden - email access", severity: "dangerous" },
  { pattern: /import\s+telnetlib\b/i, issue: "Importing 'telnetlib' is forbidden - telnet access", severity: "dangerous" },
  { pattern: /import\s+asyncio\b/i, issue: "Importing 'asyncio' is forbidden - async operations", severity: "dangerous" },
  { pattern: /import\s+aiohttp\b/i, issue: "Importing 'aiohttp' is forbidden - async HTTP", severity: "dangerous" },
  { pattern: /import\s+httpx\b/i, issue: "Importing 'httpx' is forbidden - HTTP client", severity: "dangerous" },
  
  // File operations
  { pattern: /\bopen\s*\(/i, issue: "File operations with 'open()' are forbidden", severity: "dangerous" },
  { pattern: /\bwith\s+open\s*\(/i, issue: "File operations with 'open()' are forbidden", severity: "dangerous" },
  { pattern: /import\s+io\b/i, issue: "Importing 'io' is forbidden - file I/O operations", severity: "dangerous" },
  { pattern: /import\s+pathlib\b/i, issue: "Importing 'pathlib' is forbidden - filesystem access", severity: "dangerous" },
  { pattern: /import\s+tempfile\b/i, issue: "Importing 'tempfile' is forbidden - temp file creation", severity: "dangerous" },
  { pattern: /import\s+glob\b/i, issue: "Importing 'glob' is forbidden - filesystem scanning", severity: "dangerous" },
  
  // Dynamic code execution
  { pattern: /\bexec\s*\(/i, issue: "Dynamic code execution with 'exec()' is forbidden", severity: "dangerous" },
  { pattern: /\beval\s*\(/i, issue: "Dynamic code execution with 'eval()' is forbidden", severity: "dangerous" },
  { pattern: /\bcompile\s*\(/i, issue: "Dynamic code compilation with 'compile()' is forbidden", severity: "dangerous" },
  { pattern: /__import__\s*\(/i, issue: "Dynamic imports with '__import__' are forbidden", severity: "dangerous" },
  { pattern: /\bgetattr\s*\(\s*__builtins__/i, issue: "Accessing builtins dynamically is forbidden", severity: "dangerous" },
  { pattern: /globals\s*\(\s*\)/i, issue: "Accessing globals() is forbidden", severity: "dangerous" },
  { pattern: /locals\s*\(\s*\)/i, issue: "Accessing locals() is forbidden - potential code introspection", severity: "warning" },
  { pattern: /\bvars\s*\(\s*\)/i, issue: "Accessing vars() is forbidden - potential code introspection", severity: "warning" },
  
  // Pickle and serialization (code execution risk)
  { pattern: /import\s+pickle\b/i, issue: "Importing 'pickle' is forbidden - arbitrary code execution risk", severity: "dangerous" },
  { pattern: /from\s+pickle\s+import/i, issue: "Importing from 'pickle' is forbidden", severity: "dangerous" },
  { pattern: /import\s+marshal\b/i, issue: "Importing 'marshal' is forbidden - code object serialization", severity: "dangerous" },
  { pattern: /import\s+shelve\b/i, issue: "Importing 'shelve' is forbidden - uses pickle internally", severity: "dangerous" },
  { pattern: /import\s+dill\b/i, issue: "Importing 'dill' is forbidden - extended pickle", severity: "dangerous" },
  
  // Process/resource manipulation
  { pattern: /os\s*\.\s*fork\s*\(/i, issue: "Process forking (os.fork) is forbidden - DoS risk", severity: "dangerous" },
  { pattern: /os\s*\.\s*system\s*\(/i, issue: "System command execution (os.system) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*popen\s*\(/i, issue: "Process spawning (os.popen) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*exec/i, issue: "Process execution (os.exec*) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*spawn/i, issue: "Process spawning (os.spawn*) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*kill\s*\(/i, issue: "Process killing (os.kill) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*remove\s*\(/i, issue: "File deletion (os.remove) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*rmdir\s*\(/i, issue: "Directory deletion (os.rmdir) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*unlink\s*\(/i, issue: "File unlinking (os.unlink) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*chmod\s*\(/i, issue: "Permission changes (os.chmod) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*chown\s*\(/i, issue: "Ownership changes (os.chown) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*environ/i, issue: "Environment variable access (os.environ) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*getenv\s*\(/i, issue: "Environment variable access (os.getenv) is forbidden", severity: "dangerous" },
  { pattern: /os\s*\.\s*putenv\s*\(/i, issue: "Environment variable modification (os.putenv) is forbidden", severity: "dangerous" },
  
  // Infinite loops and resource exhaustion
  { pattern: /while\s+True\s*:/i, issue: "Infinite loop 'while True' detected - must have break condition", severity: "warning" },
  { pattern: /while\s+1\s*:/i, issue: "Infinite loop 'while 1' detected - must have break condition", severity: "warning" },
  { pattern: /for\s+\w+\s+in\s+iter\s*\(\s*int\s*,\s*1\s*\)/i, issue: "Infinite iterator detected", severity: "dangerous" },
  { pattern: /\[\s*\]\s*\*\s*\d{7,}/i, issue: "Large memory allocation detected - DoS risk", severity: "dangerous" },
  { pattern: /range\s*\(\s*\d{9,}\s*\)/i, issue: "Extremely large range - memory exhaustion risk", severity: "dangerous" },
  { pattern: /\*\s*\*\s*\d{6,}/i, issue: "Large exponentiation detected - CPU exhaustion risk", severity: "warning" },
  { pattern: /\[\s*['"][^'"]*['"]\s*\]\s*\*\s*\d{8,}/i, issue: "Large string multiplication - memory exhaustion", severity: "dangerous" },
  
  // Introspection and meta-programming
  { pattern: /__class__/i, issue: "Class introspection (__class__) may be dangerous", severity: "warning" },
  { pattern: /__bases__/i, issue: "Base class access (__bases__) is forbidden", severity: "dangerous" },
  { pattern: /__subclasses__/i, issue: "Subclass enumeration (__subclasses__) is forbidden", severity: "dangerous" },
  { pattern: /__mro__/i, issue: "Method resolution order access (__mro__) is forbidden", severity: "dangerous" },
  { pattern: /__code__/i, issue: "Code object access (__code__) is forbidden", severity: "dangerous" },
  { pattern: /__globals__/i, issue: "Global scope access (__globals__) is forbidden", severity: "dangerous" },
  { pattern: /__reduce__/i, issue: "Reduce protocol (__reduce__) is forbidden - pickle exploit vector", severity: "dangerous" },
  { pattern: /__getattribute__/i, issue: "Attribute interception (__getattribute__) is suspicious", severity: "warning" },
  
  // External URLs in strings (data exfiltration)
  { pattern: /https?:\/\/[^\s'"]+/i, issue: "External URL detected - potential data exfiltration", severity: "dangerous" },
  { pattern: /\bpost\s*\(/i, issue: "HTTP POST method detected - potential data exfiltration", severity: "dangerous" },
  { pattern: /\bget\s*\(\s*['"]https?:/i, issue: "HTTP GET request detected - potential data exfiltration", severity: "dangerous" },
  
  // Debugging and inspection
  { pattern: /import\s+pdb\b/i, issue: "Importing 'pdb' is forbidden - debugger", severity: "dangerous" },
  { pattern: /import\s+inspect\b/i, issue: "Importing 'inspect' is forbidden - code introspection", severity: "dangerous" },
  { pattern: /import\s+dis\b/i, issue: "Importing 'dis' is forbidden - bytecode disassembly", severity: "dangerous" },
  { pattern: /import\s+traceback\b/i, issue: "Importing 'traceback' is forbidden", severity: "warning" },
  
  // Cryptography and security bypass
  { pattern: /import\s+hashlib\b/i, issue: "Importing 'hashlib' - verify legitimate use", severity: "warning" },
  { pattern: /import\s+secrets\b/i, issue: "Importing 'secrets' - verify legitimate use", severity: "warning" },
];

// Cost function specific patterns (cheating detection)
const COST_FUNCTION_PATTERNS: DangerousPattern[] = [
  { pattern: /user_id|submitter|author/i, issue: "Cost function references user identity - potential favoritism/cheating", severity: "dangerous" },
  { pattern: /creator|owner|admin/i, issue: "Cost function references creator/admin - potential bias", severity: "dangerous" },
  { pattern: /if\s+.*==\s*['"][a-zA-Z0-9_]+['"].*:\s*\n\s*return\s+0/i, issue: "Conditional zero return based on string match - potential cheating", severity: "dangerous" },
  { pattern: /account|username|email/i, issue: "Cost function references account info - potential cheating", severity: "dangerous" },
  { pattern: /friend|ally|partner/i, issue: "Cost function references relationships - potential collusion", severity: "warning" },
  { pattern: /random\s*\.\s*random\s*\(\s*\)/i, issue: "Cost function uses random values - should be deterministic", severity: "dangerous" },
  { pattern: /time\s*\.\s*time\s*\(\s*\)/i, issue: "Cost function uses current time - should be deterministic", severity: "warning" },
  { pattern: /datetime\s*\.\s*now\s*\(\s*\)/i, issue: "Cost function uses current time - should be deterministic", severity: "warning" },
];

// Allowed imports (safe mathematical and utility libraries ONLY)
const ALLOWED_IMPORTS = [
  "math", "random", "statistics", "collections", "itertools", "functools",
  "json", "re", "datetime", "time", "decimal", "fractions",
  "numpy", "pandas", "scipy", "sklearn", "typing", "dataclasses",
  "heapq", "bisect", "array", "copy", "operator", "string"
];

function staticAnalysis(code: string, codeType: string): { issues: string[]; severity: Severity } {
  const issues: string[] = [];
  let hasDangerous = false;
  let hasWarning = false;

  // Check general dangerous patterns
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

  // Check cost function specific patterns
  if (codeType === "cost_function") {
    for (const { pattern, issue, severity } of COST_FUNCTION_PATTERNS) {
      if (pattern.test(code)) {
        issues.push(issue);
        if (severity === "dangerous") {
          hasDangerous = true;
        } else if (severity === "warning") {
          hasWarning = true;
        }
      }
    }
  }

  // Check for suspicious patterns that bypass import checks
  const suspiciousPatterns = [
    { pattern: /\.\s*system\s*\(/i, issue: "System call detected", severity: "dangerous" as Severity },
    { pattern: /\.\s*popen\s*\(/i, issue: "Process open detected", severity: "dangerous" as Severity },
    { pattern: /\.\s*fork\s*\(/i, issue: "Process fork detected - DoS risk", severity: "dangerous" as Severity },
    { pattern: /\.\s*exec[lvpe]*\s*\(/i, issue: "Process exec detected", severity: "dangerous" as Severity },
    { pattern: /\.\s*spawn[lvpe]*\s*\(/i, issue: "Process spawn detected", severity: "dangerous" as Severity },
    { pattern: /importlib/i, issue: "Dynamic import library detected", severity: "dangerous" as Severity },
    { pattern: /builtins/i, issue: "Builtins access detected", severity: "warning" as Severity },
  ];

  for (const { pattern, issue, severity } of suspiciousPatterns) {
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

    console.log(`Validating ${codeType}:`, code.substring(0, 200) + "...");

    if (!code || !codeType) {
      return new Response(
        JSON.stringify({ isValid: false, issues: ["Code and codeType are required"], severity: "dangerous" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First, run comprehensive static analysis
    const staticResult = staticAnalysis(code, codeType);
    
    console.log("Static analysis result:", staticResult);
    
    // If static analysis finds dangerous patterns, reject immediately
    if (staticResult.severity === "dangerous") {
      console.log("Rejecting due to dangerous static analysis");
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
      console.log("No API key, using static analysis only");
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
      cost_function: "a cost function that evaluates solution quality. It takes (test_input, solution_output) and returns a numeric cost.",
      test_input_generator: "a test input generator that creates test data using ONLY built-in fetchers: fetch_stock, fetch_crypto, fetch_weather, or fetch_random.",
      algorithm: "a solution algorithm that solves a problem. It takes test_input and returns a solution.",
    };

    const systemPrompt = `You are a strict Python code security analyzer. Your job is to BLOCK any potentially malicious code.

The code should be ${codeTypeDescription[codeType]}.

CRITICAL SECURITY CHECKS - Mark as DANGEROUS if ANY of these are found:

1. DATA EXFILTRATION:
   - Any HTTP requests (requests, urllib, http, socket, aiohttp, httpx)
   - Any URLs in the code (http://, https://)
   - Any .post(), .get(), .put(), .delete() method calls
   - Any network communication

2. SYSTEM ACCESS:
   - os, sys, subprocess, shutil imports or usage
   - File operations (open, read, write)
   - Process creation (fork, spawn, exec, popen)
   - Environment variables access

3. DENIAL OF SERVICE:
   - while True without clear break
   - os.fork() - creates infinite processes
   - Large memory allocations
   - Infinite recursion

4. CODE INJECTION:
   - eval(), exec(), compile()
   - __import__(), importlib
   - pickle (arbitrary code execution)

5. CHEATING (for cost functions):
   - References to user_id, submitter_id, account, creator
   - Conditional returns based on identity strings
   - "if user == 'something': return 0" patterns
   - Any favoritism based on who submitted the solution

6. RESOURCE MANIPULATION:
   - ctypes, resource, gc manipulation
   - Thread/process creation
   - Signal handling

ALLOWED libraries: ${ALLOWED_IMPORTS.join(", ")}
ALLOWED built-in fetchers (for test_input_generator ONLY): fetch_stock, fetch_crypto, fetch_weather, fetch_random

Return ONLY valid JSON:
{
  "isValid": boolean,
  "issues": ["list of specific issues found"],
  "severity": "safe" | "warning" | "dangerous"
}

BE STRICT. When in doubt, mark as dangerous. Better to reject safe code than allow malicious code.`;

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
          { role: "user", content: `ANALYZE THIS CODE FOR SECURITY ISSUES:\n\nCode Type: ${codeType}\n\n\`\`\`python\n${code}\n\`\`\`\n\nCheck for ALL security issues including data exfiltration, system access, DoS attacks, and cheating patterns.` },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error("AI analysis failed, using static analysis only");
      // If AI fails, be conservative - if there are any warnings, reject
      return new Response(
        JSON.stringify({
          isValid: staticResult.issues.length === 0,
          issues: staticResult.issues.length > 0 
            ? [...staticResult.issues, "AI analysis unavailable - manual review recommended"]
            : [],
          severity: staticResult.issues.length > 0 ? "warning" : "safe",
        } as ValidationResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    console.log("AI response:", content);

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

      console.log("Combined result:", { issues: combinedIssues, severity: combinedSeverity });

      return new Response(
        JSON.stringify({
          isValid: combinedSeverity !== "dangerous",
          issues: combinedIssues,
          severity: combinedSeverity,
        } as ValidationResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // If AI parsing fails, be conservative
      return new Response(
        JSON.stringify({
          isValid: staticResult.issues.length === 0,
          issues: staticResult.issues.length > 0 
            ? [...staticResult.issues, "AI analysis parse error - manual review recommended"]
            : [],
          severity: staticResult.issues.length > 0 ? "warning" : "safe",
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
