import "server-only"
import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { TestCase } from "@/db/schema"

export interface TestResult {
  input: string
  expected: string
  output: string
  passed: boolean
  error?: string
}

export interface RunResult {
  compileError?: string
  results: TestResult[]
}

const MAX_OUTPUT = 4000

/** Compare outputs ignoring trailing spaces and blank lines at the end. */
const normalize = (s: string) =>
  s
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim()

function check(test: TestCase, output: string, error?: string): TestResult {
  return {
    input: test.input,
    expected: test.expected,
    output: output.slice(0, MAX_OUTPUT),
    passed: !error && normalize(output) === normalize(test.expected),
    ...(error && { error: error.slice(0, MAX_OUTPUT) }),
  }
}

// ── One program for all tests ────────────────────────────────────────────────
// The harness's main() becomes a normal function called once per test, with cin and cout
// pointed at in-memory streams. So the code compiles once, however many tests there are.
// It turns into `auto`, not `int`: a main() with no return statement is fine, but any other
// int function that falls off its end is undefined behavior (and crashes at -O2).

const MARK = "@@sb-test-"

/** A C++ string literal holding any text. */
function cString(text: string) {
  const body = [...Buffer.from(text, "utf8")]
    .map((b) => {
      if (b === 0x5c) return "\\\\"
      if (b === 0x22) return '\\"'
      if (b === 0x0a) return "\\n"
      if (b >= 0x20 && b < 0x7f) return String.fromCharCode(b)
      return `\\${b.toString(8).padStart(3, "0")}`
    })
    .join("")
  return `"${body}"`
}

const HARNESS_MAIN = /\b(?:int|signed)\s+main\s*\(\s*(?:void)?\s*\)/

function batchSource(code: string, harness: string, tests: TestCase[]) {
  return `#include <exception>
#include <iostream>
#include <sstream>
#include <string>
#line 1 "solution.cpp"
${code}

#line 1 "harness.cpp"
${harness.replace(HARNESS_MAIN, "auto sb_harness_main()")}

int main() {
  const char* inputs[] = {${tests.map((t) => cString(t.input)).join(", ")}};
  for (int t = 0; t < ${tests.length}; t++) {
    std::istringstream in(inputs[t]);
    std::ostringstream out;
    std::streambuf* realIn = std::cin.rdbuf(in.rdbuf());
    std::streambuf* realOut = std::cout.rdbuf(out.rdbuf());
    std::cin.clear();
    std::string error;
    try { sb_harness_main(); }
    catch (const std::exception& e) { error = std::string("Threw: ") + e.what(); }
    catch (...) { error = "Threw an exception"; }
    std::cin.rdbuf(realIn);
    std::cout.rdbuf(realOut);
    std::cout << "\\n${MARK}" << t << "@@" << error << "\\n" << out.str() << std::flush;
  }
}
`
}

/** What one run of the program gave back. `failure` is set when it crashed or ran too long. */
interface Execution {
  compileError?: string
  stdout: string
  failure?: string
}

function toResults(tests: TestCase[], run: Execution): TestResult[] {
  const outputs = new Map<number, { output: string; error: string }>()
  const parts = `\n${run.stdout}`.split(new RegExp(`\\n${MARK}(\\d+)@@(.*)\\n`))
  for (let i = 1; i + 2 < parts.length; i += 3) outputs.set(Number(parts[i]), { output: parts[i + 2], error: parts[i + 1] })
  return tests.map((test, i) => {
    const got = outputs.get(i)
    if (!got) return check(test, "", run.failure ?? "Didn't run: the program stopped early")
    return check(test, got.output, got.error || undefined)
  })
}

// ── Compiler Explorer (godbolt.org): free public compiler service (production) ──

interface GodboltResponse {
  didExecute?: boolean
  code?: number
  timedOut?: boolean
  stdout?: { text: string }[]
  stderr?: { text: string }[]
  buildResult?: { code?: number; stderr?: { text: string }[] }
}

const lines = (out?: { text: string }[]) => (out ?? []).map((l) => l.text).join("\n")

async function runOnGodbolt(source: string): Promise<Execution> {
  const res = await fetch("https://godbolt.org/api/compiler/g132/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      source,
      lang: "c++",
      options: {
        userArguments: "-std=c++17 -O2",
        executeParameters: { args: [], stdin: "" },
        compilerOptions: { executorRequest: true },
        filters: { execute: true },
        tools: [],
        libraries: [],
      },
    }),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) throw new Error(`Compiler Explorer answered HTTP ${res.status}`)
  const r: GodboltResponse = await res.json()
  if (!r.didExecute) {
    if (r.buildResult?.code) return { compileError: lines(r.buildResult.stderr) || "Compile failed.", stdout: "" }
    throw new Error("Compiler Explorer didn't run the program")
  }
  const failure = r.timedOut ? "Too slow: the run took too long" : r.code ? [`Exited with code ${r.code}`, lines(r.stderr)].filter(Boolean).join("\n") : undefined
  return { stdout: lines(r.stdout), failure }
}

// ── Wandbox: backup free compiler service ────────────────────────────────────

interface WandboxResponse {
  status?: string
  signal?: string
  compiler_error?: string
  program_output?: string
  program_error?: string
}

async function runOnWandbox(source: string): Promise<Execution> {
  const res = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compiler: "gcc-13.2.0", code: source, stdin: "", "compiler-option-raw": "-std=c++17\n-O2" }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`The code runner is busy (HTTP ${res.status}). Try again in a moment.`)
  const r: WandboxResponse = await res.json()
  if (r.compiler_error && !r.program_output && r.status !== "0") return { compileError: r.compiler_error, stdout: "" }
  const failure = r.signal ? `Crashed (${r.signal})` : r.status && r.status !== "0" ? `Exited with code ${r.status}` : undefined
  return { stdout: r.program_output ?? "", failure: failure && [failure, r.program_error].filter(Boolean).join("\n") }
}

/** Compiler Explorer first, Wandbox if it's down: both are free and can have bad days. */
async function runOnline(source: string): Promise<Execution> {
  try {
    return await runOnGodbolt(source)
  } catch (e) {
    console.warn("Compiler Explorer failed, trying Wandbox:", e)
    return runOnWandbox(source)
  }
}

// ── Local g++ (development only) ─────────────────────────────────────────────

function exec(cmd: string, args: string[], timeoutMs: number) {
  return new Promise<{ code: number | null; signal: string | null; stdout: string; stderr: string; timedOut: boolean }>((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, timeoutMs)
    child.stdout.on("data", (d) => (stdout = (stdout + d).slice(0, 200_000)))
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(0, MAX_OUTPUT * 2)))
    child.on("close", (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal, stdout, stderr, timedOut })
    })
    child.on("error", (e) => {
      clearTimeout(timer)
      resolve({ code: -1, signal: null, stdout, stderr: e.message, timedOut })
    })
  })
}

async function runLocally(source: string): Promise<Execution> {
  const dir = await mkdtemp(join(tmpdir(), "sb-run-"))
  try {
    await writeFile(join(dir, "main.cpp"), source)
    const build = await exec("g++", ["-std=c++17", "-O2", "-o", join(dir, "main"), join(dir, "main.cpp")], 30_000)
    if (build.code !== 0) return { compileError: build.stderr || "Compile failed.", stdout: "" }
    const run = await exec(join(dir, "main"), [], 10_000)
    const failure = run.timedOut
      ? "Too slow: took over 10 seconds"
      : run.signal
        ? `Crashed (${run.signal})`
        : run.code !== 0
          ? [`Exited with code ${run.code}`, run.stderr].filter(Boolean).join("\n")
          : undefined
    return { stdout: run.stdout, failure }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * Compiles the user's code with the note's test harness and runs every test case in one go.
 * Local g++ in development, a free online compiler in production.
 */
export async function runTests(code: string, harness: string, tests: TestCase[]): Promise<RunResult> {
  if (!HARNESS_MAIN.test(harness)) return { compileError: "The test runner needs an `int main()` with no arguments.", results: [] }
  const source = batchSource(code, harness, tests)
  const local = process.env.NODE_ENV !== "production" && process.env.CODE_RUNNER !== "online"
  const run = local ? await runLocally(source) : await runOnline(source)
  if (run.compileError) return { compileError: run.compileError.slice(0, MAX_OUTPUT), results: [] }
  return { results: toResults(tests, run) }
}
