"use server"

import { z } from "zod"
import { notesNeedingEmbedding, saveEmbeddings, searchNotes } from "@/server/search"
import { requireUser } from "@/server/session"

export async function searchAction(q: string, embedding: number[] | null) {
  const user = await requireUser()
  return searchNotes(user.id, String(q).slice(0, 200), embedding)
}

export async function pendingEmbeddingsAction() {
  const user = await requireUser()
  return notesNeedingEmbedding(user.id)
}

const embeddingsInput = z.array(z.object({ id: z.uuid(), embedding: z.array(z.number()).length(384) })).max(50)

export async function saveEmbeddingsAction(items: { id: string; embedding: number[] }[]) {
  const user = await requireUser()
  await saveEmbeddings(user.id, embeddingsInput.parse(items))
}
