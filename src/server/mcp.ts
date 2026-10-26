import "server-only"
import { revalidatePath } from "next/cache"
import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { noteChanges, noteInput } from "@/lib/note-input"
import { createNote, findNoteByTitle, getNote, moveNote, NoteError, toInput, updateNote } from "@/server/notes"
import { searchNotes } from "@/server/search"
import { countDue, findSectionByName, listSections } from "@/server/sections"
import { getSettings } from "@/server/settings"
import { activity, dueSummary, weakSpots } from "@/server/stats"
import { findOrCreateTopic, outline } from "@/server/topics"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const noteUrl = (id: string) => `${APP_URL}/n/${id}`

/** Read by Claude when it connects: how to write notes that work for interview prep. */
const INSTRUCTIONS = `Second Brain holds what the user learns, and uses spaced repetition so they can explain it in a FAANG interview.

When to save
- Save a note only after the user says they fully understand the idea. If unsure, ask first.
- Call search_notes first. If the idea already has a note, use update_note instead of making a duplicate.
- One idea per note. The title names the idea in a few words, e.g. "How JWT auth works".

Where it goes
- Call list_sections. Put the note in the right section (e.g. Web Dev, DSA, AI).
- Reuse an existing topic when it fits; otherwise name a new short topic (it is created for you).

The 4 steps (fill all of them)
1. understand (Markdown): everything needed to fully get it after one read. Plain words first, then an analogy, steps, a table or a \`\`\`mermaid diagram where they help, and a small example. Link related notes with [[Exact note title]].
2. code: snippets worth typing out, each with one short line note per important part.
3. sayIt (Markdown): the answer to say out loud in an interview, about 60 to 120 seconds, strong enough to impress a FAANG interviewer. Wrap the words interviewers listen for in **bold**.
   keyPoints: 3 to 7 short, specific points the spoken answer must hit. Reviews grade the user's answer against them.
4. questions: 3 or 4 questions on the idea, each from a different angle, with answers.
   followUps: 2 to 4 follow-ups an interviewer would ask next ("Why not X?", "What if...?", "How does it scale?"), with answers.

DSA
- kind "pattern" for a technique (e.g. Sliding Window). Fill signals: phrases in a problem that point to it.
- kind "problem" for a problem. Fill: statement (full text, examples, constraints), difficulty, link, patterns (titles of pattern notes; create a missing pattern note too), sayIt in this order: clarify, brute force, optimal idea, complexity, edge cases.
- The user codes in C++. starterCode and solution start with #include <bits/stdc++.h> and using namespace std, then class Solution.
- harness: a C++ int main() that is appended after the user's code. It reads ONE test case with cin, calls Solution, and prints the result with cout exactly as in expected. Use only cin/cout (no scanf, printf or exit) and no global state: main runs once per test in the same program. testCases: 3 to 6, including edge cases; input is exactly what main reads.
- timeLimitMin: minutes to solve it in an interview (easy 15, medium 25, hard 40).

Style
- Plain, simple English. Short sentences. The user has ADHD: one idea per line, no walls of text.
- After saving, give the user the note's link.`

type Ctx = { http?: { authInfo?: { extra?: Record<string, unknown> } } }

function userOf(ctx: Ctx) {
  const id = ctx.http?.authInfo?.extra?.userId
  if (typeof id !== "string") throw new Error("Not signed in. Add your Second Brain key to the connection.")
  return id
}

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] })
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true })

async function resolveNote(userId: string, ref: string) {
  const id = z.uuid().safeParse(ref).success ? ref : await findNoteByTitle(userId, ref)
  return id ? getNote(userId, id) : null
}

async function sectionOrError(userId: string, name: string) {
  const section = await findSectionByName(userId, name)
  if (section) return { section }
  const names = (await listSections(userId)).map((s) => s.name)
  return { error: `No section called "${name}". Sections: ${names.join(", ")}. Ask the user which one, or ask them to add it on the site.` }
}

function refresh() {
  revalidatePath("/", "layout")
}

export const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_sections",
      {
        title: "List sections and topics",
        description: "Every section with its topics and how many notes each has. Use it to pick where a new note goes.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async (_args, ctx) => json(await outline(userOf(ctx))),
    )

    server.registerTool(
      "search_notes",
      {
        title: "Search notes",
        description: "Find notes by words in any part of them (typos are fine). Use before creating a note to avoid duplicates.",
        inputSchema: z.object({ query: z.string().min(1).describe("Words to look for") }),
        annotations: { readOnlyHint: true },
      },
      async ({ query }, ctx) => {
        const hits = await searchNotes(userOf(ctx), query, null, 10)
        return json(hits.map((h) => ({ title: h.title, kind: h.kind, section: h.sectionName, topic: h.topicName, url: noteUrl(h.id) })))
      },
    )

    server.registerTool(
      "get_note",
      {
        title: "Read a note",
        description: "The full note (all 4 steps), where it lives, and how well the user remembers it.",
        inputSchema: z.object({ note: z.string().min(1).describe("The note's exact title (or id)") }),
        annotations: { readOnlyHint: true },
      },
      async ({ note }, ctx) => {
        const full = await resolveNote(userOf(ctx), note)
        if (!full) return fail(`No note called "${note}". Try search_notes.`)
        return json({
          ...toInput(full),
          section: full.section.name,
          topic: full.topic.name,
          url: noteUrl(full.note.id),
          review: full.card && { due: full.card.due, reviews: full.card.reps, forgotten: full.card.lapses },
          linkedFrom: full.backlinks.map((b) => b.title),
          problemsUsingThisPattern: full.problems.map((p) => p.title),
        })
      },
    )

    server.registerTool(
      "create_note",
      {
        title: "Save a new note",
        description:
          "Save a new note to the user's Second Brain. Only after the user says they fully understand the idea. The topic is created if it doesn't exist. The note comes up for review tomorrow.",
        inputSchema: noteInput.extend({
          section: z.string().min(1).describe("Section name, e.g. Web Dev, DSA, AI (see list_sections)"),
          topic: z.string().min(1).max(80).describe("Topic name inside the section, e.g. React hooks. Reuse an existing one when it fits."),
        }),
      },
      async ({ section: sectionName, topic: topicName, ...input }, ctx) => {
        const userId = userOf(ctx)
        const found = await sectionOrError(userId, sectionName)
        if (found.error) return fail(found.error)
        const topic = await findOrCreateTopic(userId, found.section!.id, topicName)
        try {
          const saved = await createNote(userId, topic.id, input)
          refresh()
          return json({
            saved: saved.title,
            url: noteUrl(saved.id),
            ...(saved.missingPatterns.length && {
              note: `No pattern note yet for: ${saved.missingPatterns.join(", ")}. Create it (kind "pattern") and the link appears.`,
            }),
          })
        } catch (e) {
          if (e instanceof NoteError) return fail(e.message)
          throw e
        }
      },
    )

    server.registerTool(
      "update_note",
      {
        title: "Change a note",
        description:
          "Change parts of an existing note. Send only the fields that change; a list you send replaces the old list. Can also move it to another section/topic.",
        inputSchema: z.object({
          note: z.string().min(1).describe("The note's exact title (or id)"),
          changes: noteChanges.describe("Only the fields to change. To rename, send a new title."),
          section: z.string().optional().describe("Move to this section (with topic)"),
          topic: z.string().max(80).optional().describe("Move to this topic (created if missing)"),
        }),
      },
      async ({ note, changes, section: sectionName, topic: topicName }, ctx) => {
        const userId = userOf(ctx)
        const full = await resolveNote(userId, note)
        if (!full) return fail(`No note called "${note}". Try search_notes.`)
        const next = noteInput.safeParse({ ...toInput(full), ...changes })
        if (!next.success) return fail(next.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "))
        try {
          const saved = await updateNote(userId, full.note.id, next.data)
          if (topicName) {
            const found = await sectionOrError(userId, sectionName ?? full.section.name)
            if (found.error) return fail(found.error)
            const topic = await findOrCreateTopic(userId, found.section!.id, topicName)
            await moveNote(userId, full.note.id, topic.id)
          }
          refresh()
          return json({ saved: saved.title, url: noteUrl(saved.id) })
        } catch (e) {
          if (e instanceof NoteError) return fail(e.message)
          throw e
        }
      },
    )

    server.registerTool(
      "get_weak_spots",
      {
        title: "Weak spots",
        description: "Notes the user keeps forgetting. Use it to suggest what to re-teach or practice.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async (_args, ctx) => {
        const rows = await weakSpots(userOf(ctx), 15)
        return json(rows.map((r) => ({ title: r.title, section: r.sectionName, topic: r.topicName, why: r.reason, url: noteUrl(r.id) })))
      },
    )

    server.registerTool(
      "get_review_stats",
      {
        title: "Review stats",
        description: "How many notes are due, the review streak, and today's progress.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async (_args, ctx) => {
        const userId = userOf(ctx)
        const settings = await getSettings(userId)
        const [due, stats, total] = await Promise.all([dueSummary(userId), activity(userId, settings.timezone, 7), countDue(userId)])
        return json({ dueNow: due.due, dueTomorrow: due.tomorrow, streakDays: stats.streak, reviewedToday: stats.reviewedToday, dueTotal: total })
      },
    )
  },
  { serverInfo: { name: "second-brain", version: "1.0.0" }, instructions: INSTRUCTIONS },
)
