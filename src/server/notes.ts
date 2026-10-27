import "server-only"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { cards, noteLinks, notePatterns, notes, sections, topics } from "@/db/schema"
import type { NoteInput } from "@/lib/note-input"
import { newCard } from "@/server/fsrs"
import { parentName, topicPath } from "@/server/topic-path"

export class NoteError extends Error {}

const LINK_RE = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g

/** Titles referenced with [[Title]] anywhere in the note. */
export function linkedTitles(input: Pick<NoteInput, "understand" | "sayIt" | "statement" | "code" | "questions" | "followUps">) {
  const text = [
    input.understand,
    input.sayIt,
    input.statement,
    ...input.code.flatMap((c) => c.notes ?? []),
    ...input.questions.flatMap((q) => [q.q, q.a]),
    ...input.followUps.flatMap((q) => [q.q, q.a]),
  ].join("\n")
  return [...new Set([...text.matchAll(LINK_RE)].map((m) => m[1].trim().toLowerCase()))]
}

function columns(input: NoteInput) {
  const isProblem = input.kind === "problem"
  return {
    kind: input.kind,
    title: input.title.trim(),
    understand: input.understand,
    code: input.code.map((c) => ({ file: c.file, code: c.code, notes: c.notes ?? [] })),
    sayIt: input.sayIt,
    keyPoints: input.keyPoints,
    questions: input.questions,
    followUps: input.followUps,
    signals: input.kind === "pattern" ? input.signals : [],
    statement: isProblem ? input.statement : "",
    difficulty: isProblem ? input.difficulty : null,
    link: isProblem ? input.link : null,
    starterCode: isProblem ? input.starterCode : "",
    solution: isProblem ? input.solution : "",
    harness: isProblem ? input.harness : "",
    testCases: isProblem ? input.testCases : [],
    patternTitles: isProblem ? [...new Set(input.patterns.map((t) => t.trim()).filter(Boolean))] : [],
    timeLimitMin: isProblem ? input.timeLimitMin : null,
  }
}

async function assertTitleFree(userId: string, title: string, exceptId?: string) {
  const [clash] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.userId, userId), sql`lower(${notes.title}) = lower(${title.trim()})`))
  if (clash && clash.id !== exceptId) throw new NoteError(`A note called "${title.trim()}" already exists.`)
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Rebuilds [[links]] and problem → pattern links. Returns pattern titles that didn't match a pattern note. */
async function syncRelations(tx: Tx, userId: string, noteId: string, input: NoteInput) {
  await tx.delete(noteLinks).where(eq(noteLinks.fromId, noteId))
  const titles = linkedTitles(input)
  if (titles.length) {
    const targets = await tx
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.userId, userId), inArray(sql`lower(${notes.title})`, titles)))
    const rows = targets.filter((t) => t.id !== noteId).map((t) => ({ fromId: noteId, toId: t.id }))
    if (rows.length) await tx.insert(noteLinks).values(rows).onConflictDoNothing()
  }

  await tx.delete(notePatterns).where(eq(notePatterns.problemId, noteId))
  const wanted = input.kind === "problem" ? [...new Set(input.patterns.map((p) => p.trim()).filter(Boolean))] : []
  if (!wanted.length) return []
  const found = await tx
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.kind, "pattern"), inArray(sql`lower(${notes.title})`, wanted.map((w) => w.toLowerCase()))))
  if (found.length) {
    await tx
      .insert(notePatterns)
      .values(found.map((p) => ({ problemId: noteId, patternId: p.id })))
      .onConflictDoNothing()
  }
  const foundTitles = new Set(found.map((p) => p.title.toLowerCase()))
  return wanted.filter((w) => !foundTitles.has(w.toLowerCase()))
}

/** Notes written before this one may already link to its title: connect them now. */
async function connectIncomingLinks(tx: Tx, userId: string, noteId: string, title: string) {
  const needle = `[[${title.trim().toLowerCase()}`
  const sources = await tx
    .select({ id: notes.id })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        sql`${notes.id} <> ${noteId}`,
        sql`position(${needle} in lower(${notes.understand} || ${notes.sayIt} || ${notes.statement} || ${notes.questions}::text || ${notes.followUps}::text || ${notes.code}::text)) > 0`,
      ),
    )
  if (sources.length) {
    await tx
      .insert(noteLinks)
      .values(sources.map((s) => ({ fromId: s.id, toId: noteId })))
      .onConflictDoNothing()
  }
}

/** A new (or renamed) pattern note: link the problems that were already waiting for it by name. */
async function connectWaitingProblems(tx: Tx, userId: string, patternId: string, title: string) {
  const waiting = await tx
    .select({ id: notes.id })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.kind, "problem"),
        sql`exists (select 1 from jsonb_array_elements_text(${notes.patternTitles}) t where lower(t) = lower(${title.trim()}))`,
      ),
    )
  if (waiting.length) {
    await tx
      .insert(notePatterns)
      .values(waiting.map((p) => ({ problemId: p.id, patternId })))
      .onConflictDoNothing()
  }
}

export async function createNote(userId: string, topicId: string, input: NoteInput) {
  const [topic] = await db.select({ id: topics.id }).from(topics).where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
  if (!topic) throw new NoteError("Topic not found.")
  await assertTitleFree(userId, input.title)

  return db.transaction(async (tx) => {
    const [note] = await tx
      .insert(notes)
      .values({ userId, topicId, ...columns(input) })
      .returning({ id: notes.id, title: notes.title })
    await tx.insert(cards).values({ noteId: note.id, userId, ...newCard() })
    const missingPatterns = await syncRelations(tx, userId, note.id, input)
    await connectIncomingLinks(tx, userId, note.id, note.title)
    if (input.kind === "pattern") await connectWaitingProblems(tx, userId, note.id, note.title)
    return { ...note, missingPatterns }
  })
}

export async function updateNote(userId: string, noteId: string, input: NoteInput) {
  await assertTitleFree(userId, input.title, noteId)
  return db.transaction(async (tx) => {
    const [note] = await tx
      .update(notes)
      .set({ ...columns(input), embedding: null, embeddedAt: null, updatedAt: new Date() })
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .returning({ id: notes.id, title: notes.title })
    if (!note) throw new NoteError("Note not found.")
    const missingPatterns = await syncRelations(tx, userId, note.id, input)
    await connectIncomingLinks(tx, userId, note.id, note.title)
    if (input.kind === "pattern") await connectWaitingProblems(tx, userId, note.id, note.title)
    return { ...note, missingPatterns }
  })
}

export async function moveNote(userId: string, noteId: string, topicId: string) {
  const [topic] = await db.select({ id: topics.id }).from(topics).where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
  if (!topic) throw new NoteError("Topic not found.")
  await db.update(notes).set({ topicId }).where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
}

export async function deleteNote(userId: string, noteId: string) {
  await db.delete(notes).where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
}

/** A note with everything its page needs: where it lives, linked patterns/problems, backlinks, review state. */
export async function getNote(userId: string, noteId: string) {
  const [row] = await db
    .select({
      note: notes,
      topicName: topics.name,
      parentId: topics.parentId,
      parentName,
      sectionId: sections.id,
      sectionName: sections.name,
      card: cards,
    })
    .from(notes)
    .innerJoin(topics, eq(topics.id, notes.topicId))
    .innerJoin(sections, eq(sections.id, topics.sectionId))
    .leftJoin(cards, eq(cards.noteId, notes.id))
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
  if (!row) return null

  const [patterns, problems, backlinks, outgoing] = await Promise.all([
    db
      .select({ id: notes.id, title: notes.title })
      .from(notePatterns)
      .innerJoin(notes, eq(notes.id, notePatterns.patternId))
      .where(eq(notePatterns.problemId, noteId)),
    db
      .select({ id: notes.id, title: notes.title, difficulty: notes.difficulty })
      .from(notePatterns)
      .innerJoin(notes, eq(notes.id, notePatterns.problemId))
      .where(eq(notePatterns.patternId, noteId))
      .orderBy(asc(notes.title)),
    db
      .select({ id: notes.id, title: notes.title })
      .from(noteLinks)
      .innerJoin(notes, eq(notes.id, noteLinks.fromId))
      .where(eq(noteLinks.toId, noteId))
      .orderBy(asc(notes.title)),
    db
      .select({ id: notes.id, title: notes.title })
      .from(noteLinks)
      .innerJoin(notes, eq(notes.id, noteLinks.toId))
      .where(eq(noteLinks.fromId, noteId)),
  ])

  const { embedding: _e, search: _s, ...note } = row.note
  return {
    note,
    topic: { id: note.topicId, name: row.topicName, parent: row.parentId ? { id: row.parentId, name: row.parentName ?? "" } : null },
    section: { id: row.sectionId, name: row.sectionName },
    card: row.card,
    patterns,
    problems,
    backlinks,
    /** title (lowercase) → id, for turning [[Title]] into links. */
    linkMap: Object.fromEntries(outgoing.map((o) => [o.title.toLowerCase(), o.id])) as Record<string, string>,
  }
}

export type FullNote = NonNullable<Awaited<ReturnType<typeof getNote>>>
export type Note = FullNote["note"]

/** Note as editable input (the shape the editor and MCP use). */
export function toInput(full: FullNote): NoteInput {
  const n = full.note
  return {
    kind: n.kind,
    title: n.title,
    understand: n.understand,
    code: n.code.map((c) => ({ ...c, notes: c.notes ?? [] })),
    sayIt: n.sayIt,
    keyPoints: n.keyPoints,
    questions: n.questions,
    followUps: n.followUps,
    signals: n.signals,
    statement: n.statement,
    difficulty: n.difficulty,
    link: n.link,
    patterns: n.patternTitles.length ? n.patternTitles : full.patterns.map((p) => p.title),
    starterCode: n.starterCode,
    solution: n.solution,
    harness: n.harness,
    testCases: n.testCases,
    timeLimitMin: n.timeLimitMin,
  }
}

export async function findNoteByTitle(userId: string, title: string) {
  const [row] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.userId, userId), sql`lower(${notes.title}) = lower(${title.trim()})`))
  return row?.id ?? null
}

export async function recentNotes(userId: string, limit = 6) {
  return db
    .select({ id: notes.id, title: notes.title, kind: notes.kind, topicName: topicPath, sectionName: sections.name, createdAt: notes.createdAt })
    .from(notes)
    .innerJoin(topics, eq(topics.id, notes.topicId))
    .innerJoin(sections, eq(sections.id, topics.sectionId))
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.createdAt))
    .limit(limit)
}

export async function listPatterns(userId: string) {
  return db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.kind, "pattern")))
    .orderBy(asc(notes.title))
}

/** Every note title, for [[link]] autocomplete and the "move to" picker. */
export async function listNoteTitles(userId: string) {
  return db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(asc(notes.title))
}
