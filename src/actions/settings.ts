"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createApiKey, revokeApiKey } from "@/server/api-keys"
import { saveSubscription, sendToUser } from "@/server/push"
import { requireUser } from "@/server/session"
import { isValidTimeZone, updateSettings } from "@/server/settings"

/** The browser tells us its time zone, so "today", streaks and reminders follow the user's clock. */
export async function syncTimezoneAction(timeZone: string) {
  const user = await requireUser()
  if (!isValidTimeZone(timeZone)) return
  await updateSettings(user.id, { timezone: timeZone })
}

/** Returns the full key. It is shown once and never stored. */
export async function createApiKeyAction(name: string) {
  const user = await requireUser()
  const { key } = await createApiKey(user.id, z.string().trim().min(1).max(60).parse(name))
  revalidatePath("/settings")
  return key
}

export async function revokeApiKeyAction(id: string) {
  const user = await requireUser()
  await revokeApiKey(user.id, z.uuid().parse(id))
  revalidatePath("/settings")
}

export async function setDailyMinutesAction(minutes: number) {
  const user = await requireUser()
  await updateSettings(user.id, { dailyMinutes: z.number().int().min(5).max(60).parse(minutes) })
  revalidatePath("/", "layout")
}

const pushSubscription = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
})

const reminderTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export async function enableRemindersAction(sub: z.input<typeof pushSubscription>, time: string) {
  const user = await requireUser()
  await saveSubscription(user.id, pushSubscription.parse(sub))
  await updateSettings(user.id, { remindersEnabled: true, reminderTime: reminderTime.parse(time) })
  revalidatePath("/settings")
}

export async function disableRemindersAction() {
  const user = await requireUser()
  await updateSettings(user.id, { remindersEnabled: false })
  revalidatePath("/settings")
}

export async function setReminderTimeAction(time: string) {
  const user = await requireUser()
  // A new time today means today's reminder can still come.
  await updateSettings(user.id, { reminderTime: reminderTime.parse(time), lastRemindedOn: null })
  revalidatePath("/settings")
}

export async function sendTestPushAction() {
  const user = await requireUser()
  const sent = await sendToUser(user.id, { title: "Second Brain", body: "Reminders work. See you at review time.", url: "/" })
  return sent
}
