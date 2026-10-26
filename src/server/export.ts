import "server-only"
import { asc, eq } from "drizzle-orm"
import { strToU8, zipSync, type Zippable } from "fflate"
import { db } from "@/db"
import { cards, notePatterns, notes, reviews, sections, settings, topics } from "@/db/schema"

const safe = (name: string) => name.replace(/[\\/:*?"<>|\n\r]+/g, "-").trim().slice(0, 100) || "untitled"

type NoteRow = typeof notes.$inferSelect

/** One note as a readable Markdown file (works in Obsidian too). */
function toMarkdown(n: NoteRow, where: { section: string; topic: string }, patterns: string[]) {
  const front = [
    "---",
    `kind: ${n.kind}`,
    `section: ${JSON.stringify(where.section)}`,
    `topic: ${JSON.stringify(where.topic)}`,
    ...(n.difficulty ? [`difficulty: ${n.difficulty}`] : []),
    ...(n.link ? [`link: ${n.link}`] : []),
    ...(patterns.length ? [`patterns: ${JSON.stringify(patterns)}`] : []),
    `created: ${n.createdAt.toISOString()}`,
    "---",
  ]
  const out = [...front, "", `# ${n.title}`, "", "## Understand", ""]
  if (n.statement.trim()) out.push("### Problem", "", n.statement, "")
  if (n.signals.length) out.push("### Signals", "", ...n.signals.map((s) => `- ${s}`), "")
  if (n.understand.trim()) out.push(n.understand, "")
  if (n.code.length || n.solution.trim()) {
    out.push("## Code", "")
    for (const c of n.code) out.push(`\`\`\`${c.file.split(".").pop() ?? ""}`, `// ${c.file}`, c.code, "```", ...(c.notes ?? []).map((l) => `- ${l}`), "")
    if (n.solution.trim()) out.push("### Solution", "", "```cpp", n.solution, "```", "")
  }
  out.push("## Say it", "", n.sayIt, "")
  if (n.keyPoints.length) out.push("**Key points**", "", ...n.keyPoints.map((k) => `- ${k}`), "")
  if (n.questions.length || n.followUps.length) {
    out.push("## Test", "")
    for (const q of n.questions) out.push(`### Q: ${q.q}`, "", q.a, "")
    for (const q of n.followUps) out.push(`### Follow-up: ${q.q}`, "", q.a, "")
  }
  return out.join("\n")
}

/** Everything the user owns, as a zip: Markdown per note + one JSON file with all data. */
export async function buildExport(userId: string) {
  const [sectionRows, topicRows, noteRows, cardRows, reviewRows, links, settingRows] = await Promise.all([
    db.select().from(sections).where(eq(sections.userId, userId)).orderBy(asc(sections.position)),
    db.select().from(topics).where(eq(topics.userId, userId)).orderBy(asc(topics.position)),
    db.select().from(notes).where(eq(notes.userId, userId)).orderBy(asc(notes.createdAt)),
    db.select().from(cards).where(eq(cards.userId, userId)),
    db.select().from(reviews).where(eq(reviews.userId, userId)).orderBy(asc(reviews.reviewedAt)),
    db.select({ problemId: notePatterns.problemId, patternId: notePatterns.patternId }).from(notePatterns).innerJoin(notes, eq(notes.id, notePatterns.problemId)).where(eq(notes.userId, userId)),
    db.select().from(settings).where(eq(settings.userId, userId)),
  ])

  const topicById = new Map(topicRows.map((t) => [t.id, t]))
  const sectionById = new Map(sectionRows.map((s) => [s.id, s]))
  const titleById = new Map(noteRows.map((n) => [n.id, n.title]))
  const files: Zippable = {}
  const used = new Set<string>()

  for (const n of noteRows) {
    const topic = topicById.get(n.topicId)
    const section = topic && sectionById.get(topic.sectionId)
    const where = { section: section?.name ?? "Unsorted", topic: topic?.name ?? "Unsorted" }
    const patterns = links.filter((l) => l.problemId === n.id).map((l) => titleById.get(l.patternId) ?? "")
    let path = `notes/${safe(where.section)}/${safe(where.topic)}/${safe(n.title)}.md`
    for (let i = 2; used.has(path); i++) path = `notes/${safe(where.section)}/${safe(where.topic)}/${safe(n.title)} ${i}.md`
    used.add(path)
    files[path] = strToU8(toMarkdown(n, where, patterns))
  }

  const data = {
    exportedAt: new Date().toISOString(),
    version: 1,
    settings: settingRows[0] ?? null,
    sections: sectionRows,
    topics: topicRows,
    notes: noteRows.map(({ embedding: _e, search: _s, ...n }) => n),
    notePatterns: links,
    cards: cardRows,
    reviews: reviewRows,
  }
  files["second-brain.json"] = strToU8(JSON.stringify(data, null, 2))
  files["README.md"] = strToU8(
    "# Second Brain export\n\n- `notes/` has one Markdown file per note, by section and topic. Open the folder in Obsidian or any editor.\n- `second-brain.json` has everything, including review history.\n",
  )
  return zipSync(files, { level: 6 })
}
