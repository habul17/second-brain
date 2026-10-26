"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { notes } from "@/db/schema"
import { recordReview } from "@/server/review"
import { runTests, type RunResult } from "@/server/runner"
import { requireUser } from "@/server/session"

const reviewResult = z.object({
  noteId: z.uuid(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  mode: z.enum(["daily", "mock", "practice"]),
  prompt: z.string().max(2000),
  score: z.number().min(0).max(1).nullable(),
  durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  patternCorrect: z.boolean().nullable(),
  testsPassed: z.number().int().min(0).nullable(),
  testsTotal: z.number().int().min(0).nullable(),
})

export async function submitReviewAction(raw: z.input<typeof reviewResult>) {
  const user = await requireUser()
  const { due } = await recordReview(user.id, reviewResult.parse(raw))
  revalidatePath("/", "layout")
  return { due: due.toISOString() }
}

export async function runCodeAction(noteId: string, code: string): Promise<RunResult | { error: string }> {
  const user = await requireUser()
  if (code.length > 50_000) return { error: "That code is too long." }
  const [note] = await db
    .select({ harness: notes.harness, testCases: notes.testCases })
    .from(notes)
    .where(and(eq(notes.id, z.uuid().parse(noteId)), eq(notes.userId, user.id)))
  if (!note) return { error: "Note not found." }
  if (!note.harness.trim() || !note.testCases.length) return { error: "This problem has no tests yet." }
  try {
    return await runTests(code, note.harness, note.testCases)
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't run the code. Try again." }
  }
}
