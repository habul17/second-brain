"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { noteInput, type NoteInput } from "@/lib/note-input"
import { createNote, deleteNote, moveNote, NoteError, updateNote } from "@/server/notes"
import { createSection, deleteSection, renameSection, reorderSections } from "@/server/sections"
import { requireUser } from "@/server/session"
import { createTopic, deleteTopic, renameTopic } from "@/server/topics"

const name = z.string().trim().min(1, "Give it a name.").max(80)
const id = z.uuid()

export async function createSectionAction(raw: string) {
  const user = await requireUser()
  const section = await createSection(user.id, name.parse(raw))
  revalidatePath("/", "layout")
  return section.id
}

export async function renameSectionAction(sectionId: string, raw: string) {
  const user = await requireUser()
  await renameSection(user.id, id.parse(sectionId), name.parse(raw))
  revalidatePath("/", "layout")
}

export async function deleteSectionAction(sectionId: string) {
  const user = await requireUser()
  await deleteSection(user.id, id.parse(sectionId))
  revalidatePath("/", "layout")
  redirect("/")
}

export async function reorderSectionsAction(ids: string[]) {
  const user = await requireUser()
  await reorderSections(user.id, z.array(id).parse(ids))
  revalidatePath("/")
}

/** A topic, or with `parentId` a subtopic of it. */
export async function createTopicAction(sectionId: string, raw: string, parentId: string | null = null) {
  const user = await requireUser()
  const topic = await createTopic(user.id, id.parse(sectionId), name.parse(raw), parentId && id.parse(parentId))
  revalidatePath("/", "layout")
  return topic.id
}

export async function renameTopicAction(topicId: string, raw: string) {
  const user = await requireUser()
  await renameTopic(user.id, id.parse(topicId), name.parse(raw))
  revalidatePath("/", "layout")
}

export async function deleteTopicAction(topicId: string) {
  const user = await requireUser()
  await deleteTopic(user.id, id.parse(topicId))
  revalidatePath("/", "layout")
}

export type SaveResult = { ok: true; id: string; missingPatterns: string[] } | { ok: false; error: string }

export async function saveNoteAction(input: NoteInput, target: { noteId?: string; topicId?: string }): Promise<SaveResult> {
  const user = await requireUser()
  const parsed = noteInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the note fields." }
  try {
    const saved = target.noteId
      ? await updateNote(user.id, id.parse(target.noteId), parsed.data)
      : await createNote(user.id, id.parse(target.topicId), parsed.data)
    revalidatePath("/", "layout")
    return { ok: true, id: saved.id, missingPatterns: saved.missingPatterns }
  } catch (e) {
    if (e instanceof NoteError) return { ok: false, error: e.message }
    throw e
  }
}

export async function moveNoteAction(noteId: string, topicId: string) {
  const user = await requireUser()
  await moveNote(user.id, id.parse(noteId), id.parse(topicId))
  revalidatePath("/", "layout")
}

export async function deleteNoteAction(noteId: string, sectionId: string) {
  const user = await requireUser()
  await deleteNote(user.id, id.parse(noteId))
  revalidatePath("/", "layout")
  redirect(`/s/${sectionId}`)
}
