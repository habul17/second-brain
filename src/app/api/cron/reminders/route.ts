import { timingSafeEqual } from "node:crypto"
import { sendDueReminders } from "@/server/push"

/** Called every 15 minutes by a scheduler (GitHub Actions) with the shared CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 })
  }
  return Response.json(await sendDueReminders())
}
