import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { apiKeys } from "@/db/schema"

const hash = (key: string) => createHash("sha256").update(key).digest("hex")

/**
 * Makes a new key. The full key is returned once and never stored: only its SHA-256 hash is,
 * so a database leak can't be used to log in. (Keys are long and random, so a slow hash isn't needed.)
 */
export async function createApiKey(userId: string, name: string) {
  const key = `sb_${randomBytes(32).toString("base64url")}`
  const [row] = await db
    .insert(apiKeys)
    .values({ userId, name, prefix: key.slice(0, 10), hash: hash(key) })
    .returning({ id: apiKeys.id })
  return { id: row.id, key }
}

export async function listApiKeys(userId: string) {
  return db
    .select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt))
}

export async function revokeApiKey(userId: string, id: string) {
  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
}

/** The user a key belongs to, or null. Also notes when it was last used. */
export async function verifyApiKey(key: string) {
  if (!key.startsWith("sb_")) return null
  const [row] = await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.hash, hash(key)))
    .returning({ userId: apiKeys.userId })
  return row?.userId ?? null
}
