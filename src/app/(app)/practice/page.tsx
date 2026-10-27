import { redirect } from "next/navigation"
import { z } from "zod"
import { ReviewSession } from "@/components/review/review-session"
import { buildSession } from "@/server/review"
import { requireUser } from "@/server/session"

export const metadata = { title: "Practice" }

/** Extra practice on chosen notes. It doesn't change when they're next due. */
export default async function PracticePage({ searchParams }: PageProps<"/practice">) {
  const user = await requireUser()
  const raw = (await searchParams).notes
  const ids = (typeof raw === "string" ? raw.split(",") : []).filter((id) => z.uuid().safeParse(id).success).slice(0, 20)
  if (!ids.length) redirect("/")
  const session = await buildSession(user.id, { noteIds: ids })
  if (!session.items.length) redirect("/")
  return <ReviewSession key={ids.join()} session={session} mode="practice" />
}
