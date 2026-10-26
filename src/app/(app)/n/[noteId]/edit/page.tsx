import { notFound } from "next/navigation"
import { z } from "zod"
import { NoteEditor } from "@/components/editor/note-editor"
import { getNote, listPatterns, toInput } from "@/server/notes"
import { requireUser } from "@/server/session"

export const metadata = { title: "Edit note" }

export default async function EditNotePage({ params }: PageProps<"/n/[noteId]/edit">) {
  const { noteId } = await params
  if (!z.uuid().safeParse(noteId).success) notFound()
  const user = await requireUser()
  const [full, patterns] = await Promise.all([getNote(user.id, noteId), listPatterns(user.id)])
  if (!full) notFound()
  return (
    <NoteEditor
      initial={toInput(full)}
      noteId={noteId}
      topics={[]}
      patternTitles={patterns.filter((p) => p.id !== noteId).map((p) => p.title)}
    />
  )
}
