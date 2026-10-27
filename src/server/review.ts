import "server-only"
import { and, asc, eq, inArray, lte, ne } from "drizzle-orm"
import { db } from "@/db"
import { cards, notePatterns, notes, reviews, sections, topics, type QA, type ReviewMode } from "@/db/schema"
import { previewDays, schedule, type ReviewRating } from "@/server/fsrs"
import { getSettings } from "@/server/settings"
import { topicPath } from "@/server/topic-path"

/** Rough minutes one review takes, to fit the daily budget. */
function minutesFor(kind: string, timeLimitMin: number | null) {
  return kind === "problem" ? Math.min(timeLimitMin ?? 20, 30) + 3 : 1.5
}

/** Takes items in order while they fit the budget (always at least one). Returns them and the minutes they need. */
function fitBudget<T>(items: T[], budget: number, cost: (item: T) => number) {
  const picked: T[] = []
  let minutes = 0
  for (const item of items) {
    const c = cost(item)
    if (picked.length === 0 || minutes + c <= budget) {
      picked.push(item)
      minutes += c
    }
  }
  return { picked, minutes }
}

/** Due notes, oldest first. Same order everywhere so the plan and the session pick the same notes. */
const dueOrder = [asc(cards.due), asc(cards.noteId)]

/**
 * What today's review will hold: the top bar, home card and reminders show this,
 * so their count matches the session. `later` is due but over the daily budget.
 */
export async function todayPlan(userId: string, dailyMinutes: number) {
  const rows = await db
    .select({ kind: notes.kind, timeLimitMin: notes.timeLimitMin })
    .from(cards)
    .innerJoin(notes, eq(notes.id, cards.noteId))
    .where(and(eq(cards.userId, userId), lte(cards.due, new Date())))
    .orderBy(...dueOrder)
    .limit(200)
  const { picked, minutes } = fitBudget(rows, dailyMinutes, (r) => minutesFor(r.kind, r.timeLimitMin))
  return { count: picked.length, minutes: Math.ceil(minutes), later: rows.length - picked.length }
}

/** Round-robin across sections, so one subject never fills a whole session. */
function interleave<T extends { sectionId: string }>(items: T[]) {
  const bySection = new Map<string, T[]>()
  for (const item of items) bySection.set(item.sectionId, [...(bySection.get(item.sectionId) ?? []), item])
  const queues = [...bySection.values()]
  const out: T[] = []
  while (out.length < items.length) for (const q of queues) if (q.length) out.push(q.shift()!)
  return out
}

/**
 * Today's review: due notes (oldest first), mixed across sections, cut to the daily time budget.
 * Pass `noteIds` to review exactly those notes instead (mock interview, practice).
 */
export async function buildSession(userId: string, { noteIds }: { noteIds?: string[] } = {}) {
  const settings = await getSettings(userId)
  const now = new Date()
  const rows = await db
    .select({ note: notes, card: cards, topicName: topicPath, sectionId: sections.id, sectionName: sections.name })
    .from(cards)
    .innerJoin(notes, eq(notes.id, cards.noteId))
    .innerJoin(topics, eq(topics.id, notes.topicId))
    .innerJoin(sections, eq(sections.id, topics.sectionId))
    .where(and(eq(cards.userId, userId), noteIds ? inArray(cards.noteId, noteIds) : lte(cards.due, now)))
    .orderBy(...dueOrder)
    .limit(200)

  const picked = noteIds ? rows : fitBudget(rows, settings.dailyMinutes, (r) => minutesFor(r.note.kind, r.note.timeLimitMin)).picked
  const ordered = noteIds ? noteIds.flatMap((id) => picked.filter((r) => r.note.id === id)) : interleave(picked)

  // Patterns for the "which pattern is it?" step of DSA problems.
  const problemIds = ordered.filter((r) => r.note.kind === "problem").map((r) => r.note.id)
  const [links, allPatterns] = await Promise.all([
    problemIds.length
      ? db.select({ problemId: notePatterns.problemId, title: notes.title }).from(notePatterns).innerJoin(notes, eq(notes.id, notePatterns.patternId)).where(inArray(notePatterns.problemId, problemIds))
      : [],
    problemIds.length
      ? db.select({ title: notes.title }).from(notes).where(and(eq(notes.userId, userId), eq(notes.kind, "pattern"))).orderBy(asc(notes.title))
      : [],
  ])

  const items = ordered.map(({ note, card, topicName, sectionName, sectionId }) => ({
    noteId: note.id,
    kind: note.kind,
    title: note.title,
    sectionId,
    sectionName,
    topicName,
    sayIt: note.sayIt,
    keyPoints: note.keyPoints,
    questions: note.questions,
    followUps: note.followUps,
    signals: note.signals,
    statement: note.statement,
    starterCode: note.starterCode,
    solution: note.solution,
    canRun: note.harness.trim() !== "" && note.testCases.length > 0,
    testCount: note.testCases.length,
    timeLimitMin: note.timeLimitMin,
    patterns: links.filter((l) => l.problemId === note.id).map((l) => l.title),
    reps: card.reps,
    preview: previewDays(card, now),
  }))

  const remaining = rows.length - picked.length
  return { items, allPatterns: allPatterns.map((p) => p.title), remaining, dailyMinutes: settings.dailyMinutes }
}

export type ReviewSession = Awaited<ReturnType<typeof buildSession>>
export type ReviewItem = ReviewSession["items"][number]
export type { QA }

export interface ReviewResult {
  noteId: string
  rating: ReviewRating
  mode: ReviewMode
  prompt: string
  score: number | null
  durationMs: number
  patternCorrect: boolean | null
  testsPassed: number | null
  testsTotal: number | null
}

/** Saves one answer: logs it, and moves the note's next review with FSRS (practice doesn't move it). */
export async function recordReview(userId: string, r: ReviewResult) {
  const [card] = await db.select().from(cards).where(and(eq(cards.noteId, r.noteId), eq(cards.userId, userId)))
  if (!card) throw new Error("Note not found.")
  const now = new Date()
  const next = r.mode === "practice" ? null : schedule(card, r.rating, now)
  await db.transaction(async (tx) => {
    await tx.insert(reviews).values({ userId, ...r, reviewedAt: now })
    if (next) await tx.update(cards).set(next).where(eq(cards.noteId, r.noteId))
  })
  return { due: next?.due ?? card.due }
}

/** Random notes for a mock interview. `problems` picks DSA problems; otherwise anything you can explain out loud. */
export async function mockPick(userId: string, count: number, { problems = false }: { problems?: boolean } = {}) {
  const rows = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.userId, userId), problems ? eq(notes.kind, "problem") : and(ne(notes.kind, "problem"), ne(notes.sayIt, ""))))
  const ids = rows.map((r) => r.id)
  // Fisher–Yates shuffle.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids.slice(0, count)
}
