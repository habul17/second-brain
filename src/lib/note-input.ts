import { z } from "zod"

const qa = z.object({
  q: z.string().trim().min(1).describe("The question"),
  a: z.string().trim().min(1).describe("The answer (Markdown)"),
})

/** Every note field, with no defaults: what Claude may send when changing a note. */
export const noteFields = {
  kind: z
    .enum(["concept", "pattern", "problem"])
    .describe('"concept" for normal notes. DSA only: "pattern" (e.g. Sliding Window) or "problem" (e.g. Two Sum).'),
  title: z.string().trim().min(1).max(160),
  understand: z
    .string()
    .describe(
      "Step 1. Markdown. Everything needed to fully understand the idea after one read: plain explanation, analogy, step-by-step, tables, ```mermaid diagrams, examples. Link other notes with [[Note title]].",
    ),
  code: z
    .array(
      z.object({
        file: z.string().trim().min(1).describe('File name or label, e.g. "auth.ts" or "solution.cpp"'),
        code: z.string().min(1),
        notes: z.array(z.string()).default([]).describe("One short line per important part of the code"),
      }),
    )
    .describe("Step 2. Code snippets."),
  sayIt: z
    .string()
    .describe(
      "Step 3. Markdown. The answer to say out loud in an interview, strong enough to impress a FAANG interviewer. Wrap the words interviewers listen for in **bold**. For DSA problems follow: clarify → brute force → optimal → code → dry run → complexity → edge cases.",
    ),
  keyPoints: z
    .array(z.string().trim().min(1))
    .describe("Short phrases the spoken answer must hit (3–7). Used to grade reviews, so keep each one specific."),
  questions: z
    .array(qa)
    .describe("Step 4. 3–4 different questions on the same idea, each from a different angle."),
  followUps: z.array(qa).describe('Interviewer follow-ups: "Why?", "What if…?", "Can you do it in O(1) space?"'),
  signals: z
    .array(z.string().trim().min(1))
    .describe('DSA pattern only: signs in a problem that point to this pattern, e.g. "longest contiguous subarray".'),
  statement: z.string().describe("DSA problem only: the problem text in Markdown, with examples and constraints."),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
  link: z.string().trim().nullable().describe("DSA problem only: LeetCode (or other) URL."),
  patterns: z.array(z.string()).describe("DSA problem only: titles of the pattern notes it uses."),
  starterCode: z.string().describe("DSA problem only: C++ starting point (class Solution with the empty method)."),
  solution: z.string().describe("DSA problem only: the full C++ solution (class Solution …)."),
  harness: z
    .string()
    .describe(
      "DSA problem only: C++ `int main()` appended after the user's code. It reads ONE test case with cin, calls Solution, and prints the result with cout exactly like `expected`. Only cin/cout (no scanf, printf or exit): main runs once per test in one program. Include needed headers at the top of the user's code, not here.",
    ),
  testCases: z
    .array(z.object({ input: z.string(), expected: z.string() }))
    .describe("DSA problem only: stdin input and exact expected stdout for each test (3–6 tests incl. edge cases)."),
  timeLimitMin: z.number().int().min(1).max(120).nullable().describe("DSA problem only: minutes to solve it in review."),
}

const F = noteFields

/** A whole note. Anything left out starts empty. */
export const noteInput = z.object({
  ...F,
  kind: F.kind.default("concept"),
  understand: F.understand.default(""),
  code: F.code.default([]),
  sayIt: F.sayIt.default(""),
  keyPoints: F.keyPoints.default([]),
  questions: F.questions.default([]),
  followUps: F.followUps.default([]),
  signals: F.signals.default([]),
  statement: F.statement.default(""),
  difficulty: F.difficulty.default(null),
  link: F.link.default(null),
  patterns: F.patterns.default([]),
  starterCode: F.starterCode.default(""),
  solution: F.solution.default(""),
  harness: F.harness.default(""),
  testCases: F.testCases.default([]),
  timeLimitMin: F.timeLimitMin.default(null),
})
export type NoteInput = z.infer<typeof noteInput>

/** Only the fields being changed. */
export const noteChanges = z.object(noteFields).partial()
export type NoteChanges = z.infer<typeof noteChanges>
