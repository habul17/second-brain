import "server-only"
import { and, count, desc, eq, gt, lte, sql } from "drizzle-orm"
import { db } from "@/db"
import { cards, notes, reviews, sections, topics } from "@/db/schema"

/** A weak spot: reviewed, and forgotten more than once or FSRS rates it hard to remember. */
export const isWeak = sql<boolean>`(${cards.reps} > 0 and (${cards.lapses} >= 2 or ${cards.difficulty} >= 7))`

/** YYYY-MM-DD for a moment, in the user's time zone. */
export function localDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Reviews per local day for the last `days` days, plus the current streak. */
export async function activity(userId: string, timeZone: string, days = 26 * 7) {
  const since = new Date(Date.now() - (days + 1) * 24 * 60 * 60 * 1000)
  const rows = await db
    .select({
      day: sql<string>`to_char(${reviews.reviewedAt} at time zone ${timeZone}, 'YYYY-MM-DD')`,
      n: count(),
    })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), gt(reviews.reviewedAt, since)))
    .groupBy(sql`1`)
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r.n])) as Record<string, number>

  const today = localDate(new Date(), timeZone)
  // Today still counts as "on streak" until midnight, even before you've reviewed.
  let cursor = byDay[today] ? today : addDays(today, -1)
  let streak = 0
  while (byDay[cursor]) {
    streak++
    cursor = addDays(cursor, -1)
  }

  const cells = Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1)
    return { day, n: byDay[day] ?? 0 }
  })
  return { cells, streak, today, reviewedToday: byDay[today] ?? 0 }
}

/** Due now, and what's coming tomorrow. */
export async function dueSummary(userId: string) {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const [[due], [soon]] = await Promise.all([
    db.select({ n: count() }).from(cards).where(and(eq(cards.userId, userId), lte(cards.due, now))),
    db
      .select({ n: count() })
      .from(cards)
      .where(and(eq(cards.userId, userId), gt(cards.due, now), lte(cards.due, tomorrow))),
  ])
  return { due: due.n, tomorrow: soon.n }
}

/**
 * Notes you keep forgetting: forgotten more than once, or FSRS rates them hard to remember.
 * `reason` is a short human explanation for the list.
 */
export async function weakSpots(userId: string, limit = 20) {
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      kind: notes.kind,
      topicName: topics.name,
      sectionName: sections.name,
      lapses: cards.lapses,
      difficulty: cards.difficulty,
      reps: cards.reps,
      due: cards.due,
    })
    .from(cards)
    .innerJoin(notes, eq(notes.id, cards.noteId))
    .innerJoin(topics, eq(topics.id, notes.topicId))
    .innerJoin(sections, eq(sections.id, topics.sectionId))
    .where(and(eq(cards.userId, userId), isWeak))
    .orderBy(desc(cards.lapses), desc(cards.difficulty))
    .limit(limit)
  return rows.map((r) => ({
    ...r,
    reason: r.lapses >= 2 ? `Forgot ${r.lapses} times` : "Hard to remember",
  }))
}
