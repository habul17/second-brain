import "server-only"
import { and, asc, eq, max, sql } from "drizzle-orm"
import { db } from "@/db"
import { notes, sections, topics } from "@/db/schema"

/** Topics of a section, each with its notes (title + kind only). */
export async function listTopicsWithNotes(userId: string, sectionId: string) {
  const topicRows = await db
    .select()
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.sectionId, sectionId)))
    .orderBy(asc(topics.position), asc(topics.createdAt))
  const noteRows = await db
    .select({ id: notes.id, title: notes.title, kind: notes.kind, topicId: notes.topicId, difficulty: notes.difficulty })
    .from(notes)
    .innerJoin(topics, eq(topics.id, notes.topicId))
    .where(and(eq(notes.userId, userId), eq(topics.sectionId, sectionId)))
    .orderBy(asc(notes.createdAt))
  return topicRows.map((t) => ({ ...t, notes: noteRows.filter((n) => n.topicId === t.id) }))
}

export async function getTopic(userId: string, id: string) {
  const [row] = await db
    .select({ id: topics.id, name: topics.name, sectionId: topics.sectionId, sectionName: sections.name })
    .from(topics)
    .innerJoin(sections, eq(sections.id, topics.sectionId))
    .where(and(eq(topics.id, id), eq(topics.userId, userId)))
  return row ?? null
}

export async function createTopic(userId: string, sectionId: string, name: string) {
  const [{ value }] = await db.select({ value: max(topics.position) }).from(topics).where(eq(topics.sectionId, sectionId))
  const [row] = await db
    .insert(topics)
    .values({ userId, sectionId, name, position: (value ?? -1) + 1 })
    .returning()
  return row
}

/** Finds a topic by name inside a section (case-insensitive), creating it if missing. */
export async function findOrCreateTopic(userId: string, sectionId: string, name: string) {
  const [existing] = await db
    .select()
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.sectionId, sectionId), sql`lower(${topics.name}) = lower(${name.trim()})`))
  return existing ?? createTopic(userId, sectionId, name.trim())
}

export async function renameTopic(userId: string, id: string, name: string) {
  await db.update(topics).set({ name }).where(and(eq(topics.id, id), eq(topics.userId, userId)))
}

export async function deleteTopic(userId: string, id: string) {
  await db.delete(topics).where(and(eq(topics.id, id), eq(topics.userId, userId)))
}

/** Every topic with its section, for the "Move to…" picker. */
export async function listAllTopics(userId: string) {
  return db
    .select({ id: topics.id, name: topics.name, sectionId: sections.id, sectionName: sections.name })
    .from(topics)
    .innerJoin(sections, eq(sections.id, topics.sectionId))
    .where(eq(topics.userId, userId))
    .orderBy(asc(sections.position), asc(topics.position), asc(topics.createdAt))
}

export type TopicOption = Awaited<ReturnType<typeof listAllTopics>>[number]

/** Every section with its topics and how many notes each holds (for Claude to pick where a note goes). */
export async function outline(userId: string) {
  const rows = await db
    .select({
      sectionId: sections.id,
      section: sections.name,
      topicId: topics.id,
      topic: topics.name,
      notes: sql<number>`count(${notes.id})::int`,
    })
    .from(sections)
    .leftJoin(topics, eq(topics.sectionId, sections.id))
    .leftJoin(notes, eq(notes.topicId, topics.id))
    .where(eq(sections.userId, userId))
    .groupBy(sections.id, topics.id)
    .orderBy(asc(sections.position), asc(topics.position), asc(topics.createdAt))
  const out: { section: string; topics: { name: string; notes: number }[] }[] = []
  for (const r of rows) {
    let s = out.find((o) => o.section === r.section)
    if (!s) out.push((s = { section: r.section, topics: [] }))
    if (r.topic) s.topics.push({ name: r.topic, notes: r.notes })
  }
  return out
}
