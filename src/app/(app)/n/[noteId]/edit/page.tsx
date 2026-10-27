import { notFound } from "next/navigation"
import { z } from "zod"
import { NoteEditor } from "@/components/editor/note-editor"
import { getNote, listPatterns, toInput } from "@/server/notes"
import { requireUser } from "@/server/session"
import { listAllTopics } from "@/server/topics"

export const metadata = { title: "Edit note" }

export default async function EditNotePage({ params }: PageProps<"/n/[noteId]/edit">) {
  const { noteId } = await params
  if (!z.uuid().safeParse(noteId).success) notFound()
  const user = await requireUser()
  const [full, patterns, topics] = await Promise.all([getNote(user.id, noteId), listPatterns(user.id), listAllTopics(user.id)])
  if (!full) notFound()
  return (
    <NoteEditor
      initial={toInput(full)}
      noteId={noteId}
      topicId={full.note.topicId}
      topics={topics}
      patternTitles={patterns.filter((p) => p.id !== noteId).map((p) => p.title)}
    />
  )
}
