import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { settings } from "@/db/schema"

export type Settings = typeof settings.$inferSelect

export async function getSettings(userId: string): Promise<Settings> {
  const [row] = await db.select().from(settings).where(eq(settings.userId, userId))
  if (row) return row
  const [created] = await db.insert(settings).values({ userId }).onConflictDoNothing().returning()
  return created ?? (await db.select().from(settings).where(eq(settings.userId, userId)))[0]
}

export async function updateSettings(userId: string, patch: Partial<Omit<Settings, "userId">>) {
  await getSettings(userId)
  await db.update(settings).set(patch).where(eq(settings.userId, userId))
}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz })
    return true
  } catch {
    return false
  }
}
