import "server-only"
import { and, eq } from "drizzle-orm"
import webpush from "web-push"
import { db } from "@/db"
import { pushSubscriptions, settings } from "@/db/schema"
import { countDue } from "@/server/sections"
import { localDate } from "@/server/stats"

let configured = false
function configure() {
  if (configured) return true
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env
  if (!pub || !priv || !subject) return false
  webpush.setVapidDetails(subject, pub, priv)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  url: string
}

export async function saveSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth } })
}

export async function removeSubscription(userId: string, endpoint: string) {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
}

/** Sends to every device the user turned reminders on for. Drops devices that unsubscribed. Returns how many got it. */
export async function sendToUser(userId: string, payload: PushPayload) {
  if (!configure()) throw new Error("Push isn't set up (missing VAPID keys).")
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 60 * 60 })
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id))
      }
    }),
  )
  return sent
}

/** Local "HH:MM" right now in a time zone. */
function localTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(date)
}

/**
 * Runs every ~15 minutes. Anyone whose reminder time has passed today (in their time zone)
 * and who hasn't been reminded yet gets one push, if they have notes due.
 */
export async function sendDueReminders(now = new Date()) {
  const rows = await db.select().from(settings).where(eq(settings.remindersEnabled, true))
  let reminded = 0
  for (const s of rows) {
    const today = localDate(now, s.timezone)
    if (s.lastRemindedOn === today || localTime(now, s.timezone) < s.reminderTime) continue
    await db.update(settings).set({ lastRemindedOn: today }).where(eq(settings.userId, s.userId))
    const due = await countDue(s.userId)
    if (due === 0) continue
    const minutes = Math.min(s.dailyMinutes, Math.max(2, Math.ceil(due * 1.5)))
    reminded += await sendToUser(s.userId, {
      title: `${due} note${due === 1 ? "" : "s"} to review`,
      body: `About ${minutes} minutes. Keep your streak going.`,
      url: "/review",
    })
  }
  return { checked: rows.length, reminded }
}
