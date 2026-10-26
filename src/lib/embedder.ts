"use client"

import { pendingEmbeddingsAction, saveEmbeddingsAction } from "@/actions/search"

export type EmbedderStatus = "idle" | "loading" | "ready" | "failed"

let worker: Worker | null = null
let nextId = 0
const waiting = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>()
let status: EmbedderStatus = "idle"
const listeners = new Set<(s: EmbedderStatus) => void>()

function setStatus(s: EmbedderStatus) {
  status = s
  listeners.forEach((l) => l(s))
}

export function onEmbedderStatus(listener: (s: EmbedderStatus) => void) {
  listeners.add(listener)
  listener(status)
  return () => void listeners.delete(listener)
}

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./embed.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (e: MessageEvent<{ id: number; vectors?: number[][]; error?: string }>) => {
      const job = waiting.get(e.data.id)
      if (!job) return
      waiting.delete(e.data.id)
      if (e.data.error) job.reject(new Error(e.data.error))
      else job.resolve(e.data.vectors ?? [])
    }
  }
  return worker
}

function run(texts: string[]) {
  const id = nextId++
  return new Promise<number[][]>((resolve, reject) => {
    waiting.set(id, { resolve, reject })
    getWorker().postMessage({ id, texts })
  })
}

/** Downloads (first time) and loads the model. Safe to call many times. */
export async function warmUp() {
  if (status === "ready" || status === "loading") return
  setStatus("loading")
  try {
    await run([])
    setStatus("ready")
    void backfill()
  } catch {
    setStatus("failed")
  }
}

/** Embedding for a search query, or null if the model isn't ready yet (word search still works). */
export async function embedQuery(text: string) {
  if (status !== "ready") return null
  try {
    const [v] = await run([text])
    return v ?? null
  } catch {
    return null
  }
}

let backfilling = false

/** Notes saved by Claude (or edited) have no embedding yet: compute them here and send them back. */
export async function backfill() {
  if (backfilling || status !== "ready") return
  backfilling = true
  try {
    for (let round = 0; round < 10; round++) {
      const pending = await pendingEmbeddingsAction()
      if (!pending.length) break
      for (let i = 0; i < pending.length; i += 8) {
        const batch = pending.slice(i, i + 8)
        const vectors = await run(batch.map((p) => p.text))
        await saveEmbeddingsAction(batch.map((p, j) => ({ id: p.id, embedding: vectors[j] })))
      }
    }
  } catch {
    // Try again next time search opens.
  } finally {
    backfilling = false
  }
}
