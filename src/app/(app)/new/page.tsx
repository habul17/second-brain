import { EMPTY_NOTE, NoteEditor } from "@/components/editor/note-editor"
import { listPatterns } from "@/server/notes"
import { requireUser } from "@/server/session"
import { listAllTopics } from "@/server/topics"

export const metadata = { title: "New note" }

export default async function NewNotePage({ searchParams }: PageProps<"/new">) {
  const user = await requireUser()
  const { topic } = await searchParams
  const [topics, patterns] = await Promise.all([listAllTopics(user.id), listPatterns(user.id)])
  const topicId = typeof topic === "string" && topics.some((t) => t.id === topic) ? topic : undefined
  return <NoteEditor initial={EMPTY_NOTE} topicId={topicId} topics={topics} patternTitles={patterns.map((p) => p.title)} />
}
