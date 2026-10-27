import { redirect } from "next/navigation"
import { ReviewSession } from "@/components/review/review-session"
import { buildSession, mockPick } from "@/server/review"
import { requireUser } from "@/server/session"

export const metadata = { title: "Mock interview" }

export default async function MockPage({ searchParams }: PageProps<"/mock">) {
  const user = await requireUser()
  const params = await searchParams
  const go = params.go === "quick" || params.go === "full" ? params.go : null
  const round = Number(params.round) || 1

  if (go) {
    const ids =
      go === "full"
        ? [...(await mockPick(user.id, 1, { problems: true })), ...(await mockPick(user.id, 4))]
        : await mockPick(user.id, 5)
    const session = ids.length ? await buildSession(user.id, { noteIds: ids }) : null
    if (session?.items.length) {
      return <ReviewSession key={`${go}-${round}`} round={round} session={session} mode="mock" timed />
    }
  }

  // Picking a round happens in a pop-up on Home.
  redirect(go ? "/?open=mock&few=1" : "/?open=mock")
}
