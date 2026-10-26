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

// ── Wandbox: free public compiler service (production) ───────────────────────

interface WandboxResponse {
  status?: string
  signal?: string
  compiler_error?: string
  program_output?: string
  program_error?: string
}

async function wandbox(code: string, stdin: string): Promise<WandboxResponse> {
  const res = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compiler: "gcc-13.2.0", code, stdin, "compiler-option-raw": "-std=c++17\n-O2" }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`The code runner is busy (HTTP ${res.status}). Try again in a moment.`)
  return res.json()
}

async function runOnWandbox(source: string, tests: TestCase[]): Promise<RunResult> {
  const replies = await Promise.all(tests.map((t) => wandbox(source, t.input)))
  const compileFailed = replies.find((r) => r.compiler_error && !r.program_output && r.status !== "0")
  if (compileFailed) return { compileError: compileFailed.compiler_error!.slice(0, MAX_OUTPUT), results: [] }
  return {
    results: replies.map((r, i) => {
      const crashed = r.signal ? `Crashed (${r.signal})` : r.status && r.status !== "0" ? `Exited with code ${r.status}` : undefined
      return check(tests[i], r.program_output ?? "", crashed && [crashed, r.program_error].filter(Boolean).join("\n"))
    }),
  }
}

// ── Local g++ (development only) ─────────────────────────────────────────────

function exec(cmd: string, args: string[], stdin: string, timeoutMs: number) {
  return new Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>((resolve) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, timeoutMs)
    child.stdout.on("data", (d) => (stdout = (stdout + d).slice(0, MAX_OUTPUT * 2)))
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(0, MAX_OUTPUT * 2)))
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
    child.on("error", (e) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: e.message, timedOut })
    })
    child.stdin.on("error", () => {})
    child.stdin.end(stdin)
  })
}

async function runLocally(source: string, tests: TestCase[]): Promise<RunResult> {
  const dir = await mkdtemp(join(tmpdir(), "sb-run-"))
  try {
    await writeFile(join(dir, "main.cpp"), source)
    const build = await exec("g++", ["-std=c++17", "-O2", "-o", join(dir, "main"), join(dir, "main.cpp")], "", 30_000)
    if (build.code !== 0) return { compileError: build.stderr.slice(0, MAX_OUTPUT) || "Compile failed.", results: [] }
    const runs = await Promise.all(tests.map((t) => exec(join(dir, "main"), [], t.input, 3_000)))
    return {
      results: runs.map((r, i) =>
        check(tests[i], r.stdout, r.timedOut ? "Too slow: took over 3 seconds" : r.code !== 0 ? [`Exited with code ${r.code}`, r.stderr].filter(Boolean).join("\n") : undefined),
      ),
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * Compiles the user's code with the note's test harness (a main() appended after it)
 * and runs every test case. Local g++ in development, Wandbox in production.
 */
export async function runTests(code: string, harness: string, tests: TestCase[]): Promise<RunResult> {
  const source = `${code}\n\n// ---- test harness ----\n${harness}\n`
  const local = process.env.NODE_ENV !== "production" && process.env.CODE_RUNNER !== "wandbox"
  return local ? runLocally(source, tests) : runOnWandbox(source, tests)
}
