import "server-only"
import { and, asc, count, eq, lte, max, sql } from "drizzle-orm"
import { db } from "@/db"
import { cards, notes, sections, settings, topics } from "@/db/schema"

export const STARTER_SECTIONS = ["Web Dev", "DSA", "AI"]

export async function createStarterSections(userId: string) {
  await db.insert(sections).values(STARTER_SECTIONS.map((name, position) => ({ userId, name, position })))
  await db.insert(settings).values({ userId }).onConflictDoNothing()
}

export async function listSections(userId: string) {
  return db.select().from(sections).where(eq(sections.userId, userId)).orderBy(asc(sections.position), asc(sections.createdAt))
}

/** Sections with how many topics and notes they hold and how many reviews are due. */
export async function listSectionsWithCounts(userId: string) {
  const now = new Date()
  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
      position: sections.position,
      topicCount: sql<number>`count(distinct ${topics.id})::int`,
      noteCount: sql<number>`count(distinct ${notes.id})::int`,
      dueCount: sql<number>`count(distinct ${cards.noteId}) filter (where ${cards.due} <= ${now})::int`,
    })
    .from(sections)
    .leftJoin(topics, eq(topics.sectionId, sections.id))
    .leftJoin(notes, eq(notes.topicId, topics.id))
    .leftJoin(cards, eq(cards.noteId, notes.id))
    .where(eq(sections.userId, userId))
    .groupBy(sections.id)
    .orderBy(asc(sections.position), asc(sections.createdAt))
  return rows
}

export async function getSection(userId: string, id: string) {
  const [row] = await db.select().from(sections).where(and(eq(sections.id, id), eq(sections.userId, userId)))
  return row ?? null
}

export async function createSection(userId: string, name: string) {
  const [{ value }] = await db.select({ value: max(sections.position) }).from(sections).where(eq(sections.userId, userId))
  const [row] = await db
    .insert(sections)
    .values({ userId, name, position: (value ?? -1) + 1 })
    .returning()
  return row
}

export async function renameSection(userId: string, id: string, name: string) {
  await db.update(sections).set({ name }).where(and(eq(sections.id, id), eq(sections.userId, userId)))
}

export async function deleteSection(userId: string, id: string) {
  await db.delete(sections).where(and(eq(sections.id, id), eq(sections.userId, userId)))
}

/** Saves a new order. `ids` is the full list of the user's section ids, top to bottom. */
export async function reorderSections(userId: string, ids: string[]) {
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(sections).set({ position }).where(and(eq(sections.id, id), eq(sections.userId, userId)))
    }
  })
}

export async function countDue(userId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(cards)
    .where(and(eq(cards.userId, userId), lte(cards.due, new Date())))
  return row?.value ?? 0
}

/** A section by name, ignoring case. */
export async function findSectionByName(userId: string, name: string) {
  const [row] = await db
    .select()
    .from(sections)
    .where(and(eq(sections.userId, userId), sql`lower(${sections.name}) = lower(${name.trim()})`))
  return row ?? null
}
