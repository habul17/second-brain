import "server-only"
import { and, asc, eq, isNull, max, sql } from "drizzle-orm"
import { db } from "@/db"
import { cards, notes, sections, topics } from "@/db/schema"
import { isWeak } from "@/server/stats"
import { parentName, splitTopicPath, topicPath } from "@/server/topic-path"

export class TopicError extends Error {}

/**
 * Topics and subtopics, each with its notes (title, kind, and whether it is due or weak), for the folder tree.
 * One section, or every section when `sectionId` is left out (the note page's sidebar can switch between them).
 */
export async function sectionTree(userId: string, sectionId?: string) {
  const inSection = sectionId ? eq(topics.sectionId, sectionId) : undefined
  const [topicRows, noteRows] = await Promise.all([
    db
      .select({ id: topics.id, name: topics.name, parentId: topics.parentId, sectionId: topics.sectionId })
      .from(topics)
      .where(and(eq(topics.userId, userId), inSection))
      .orderBy(asc(topics.position), asc(topics.createdAt)),
    db
      .select({
        id: notes.id,
        title: notes.title,
        kind: notes.kind,
        topicId: notes.topicId,
        due: sql<boolean>`coalesce(${cards.due} <= now(), false)`,
        weak: isWeak,
      })
      .from(notes)
      .innerJoin(topics, eq(topics.id, notes.topicId))
      .leftJoin(cards, eq(cards.noteId, notes.id))
      .where(and(eq(notes.userId, userId), inSection))
      .orderBy(asc(notes.createdAt)),
  ])
  return topicRows.map((t) => ({
    ...t,
    notes: noteRows.filter((n) => n.topicId === t.id).map(({ topicId: _t, weak, ...n }) => ({ ...n, weak: Boolean(weak) })),
  }))
}

export type TreeTopic = Awaited<ReturnType<typeof sectionTree>>[number]

export async function getTopic(userId: string, id: string) {
  const [row] = await db
    .select({ id: topics.id, name: topics.name, parentId: topics.parentId, parentName, sectionId: topics.sectionId, sectionName: sections.name })
    .from(topics)
    .innerJoin(sections, eq(sections.id, topics.sectionId))
    .where(and(eq(topics.id, id), eq(topics.userId, userId)))
  return row ?? null
}

/** A topic, or with `parentId` a subtopic. Subtopics stay one level deep and in their parent's section. */
export async function createTopic(userId: string, sectionId: string, name: string, parentId: string | null = null) {
  if (parentId) {
    const [parent] = await db
      .select({ sectionId: topics.sectionId, parentId: topics.parentId })
      .from(topics)
      .where(and(eq(topics.id, parentId), eq(topics.userId, userId)))
    if (!parent || parent.sectionId !== sectionId) throw new TopicError("Topic not found.")
    if (parent.parentId) throw new TopicError("A subtopic can't have its own subtopics.")
  }
  const siblings = parentId ? eq(topics.parentId, parentId) : and(eq(topics.sectionId, sectionId), isNull(topics.parentId))
  const [{ value }] = await db.select({ value: max(topics.position) }).from(topics).where(siblings)
  const [row] = await db
    .insert(topics)
    .values({ userId, sectionId, parentId, name, position: (value ?? -1) + 1 })
    .returning()
  return row
}

/**
 * Finds a topic by name inside a section (case-insensitive), creating it if missing.
 * "React › Hooks" finds or creates the subtopic Hooks under React.
 */
export async function findOrCreateTopic(userId: string, sectionId: string, path: string) {
  let parentId: string | null = null
  let topic: typeof topics.$inferSelect | undefined
  for (const name of splitTopicPath(path)) {
    ;[topic] = await db
      .select()
      .from(topics)
      .where(
        and(
          eq(topics.userId, userId),
          eq(topics.sectionId, sectionId),
          parentId ? eq(topics.parentId, parentId) : isNull(topics.parentId),
          sql`lower(${topics.name}) = lower(${name})`,
        ),
      )
    topic ??= await createTopic(userId, sectionId, name, parentId)
    parentId = topic.id
  }
  if (!topic) throw new TopicError("Give the topic a name.")
  return topic
}

export async function renameTopic(userId: string, id: string, name: string) {
  await db.update(topics).set({ name }).where(and(eq(topics.id, id), eq(topics.userId, userId)))
}

export async function deleteTopic(userId: string, id: string) {
  await db.delete(topics).where(and(eq(topics.id, id), eq(topics.userId, userId)))
}

/** Every topic with its section, in tree order (each topic followed by its subtopics), for topic pickers. */
export async function listAllTopics(userId: string) {
  const rows = await db
    .select({ id: topics.id, name: topics.name, parentId: topics.parentId, path: topicPath, sectionId: sections.id, sectionName: sections.name })
    .from(topics)
    .innerJoin(sections, eq(sections.id, topics.sectionId))
    .where(eq(topics.userId, userId))
    .orderBy(asc(sections.position), asc(topics.position), asc(topics.createdAt))
  return rows.filter((t) => !t.parentId).flatMap((t) => [t, ...rows.filter((c) => c.parentId === t.id)])
}

export type TopicOption = Awaited<ReturnType<typeof listAllTopics>>[number]

/** Every section with its topics ("React", "React › Hooks") and how many notes each holds (for Claude to pick where a note goes). */
export async function outline(userId: string) {
  const [sectionRows, topicRows, counts] = await Promise.all([
    db.select({ id: sections.id, name: sections.name }).from(sections).where(eq(sections.userId, userId)).orderBy(asc(sections.position)),
    listAllTopics(userId),
    db
      .select({ topicId: notes.topicId, n: sql<number>`count(*)::int` })
      .from(notes)
      .where(eq(notes.userId, userId))
      .groupBy(notes.topicId),
  ])
  return sectionRows.map((s) => ({
    section: s.name,
    topics: topicRows
      .filter((t) => t.sectionId === s.id)
      .map((t) => ({ name: t.path, notes: counts.find((c) => c.topicId === t.id)?.n ?? 0 })),
  }))
}
