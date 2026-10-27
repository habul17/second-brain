import Link from "next/link"
import { ReviewSession } from "@/components/review/review-session"
import { Button } from "@/components/ui/button"
import { buildSession } from "@/server/review"
import { requireUser } from "@/server/session"
import { dueSummary } from "@/server/stats"

export const metadata = { title: "Review" }

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const user = await requireUser()
  const round = Number((await searchParams).round) || 1
  const session = await buildSession(user.id)

  if (session.items.length === 0) {
    const { tomorrow } = await dueSummary(user.id)
    return (
      <div className="mx-auto grid w-full max-w-[520px] justify-items-center gap-3 pt-10 text-center sm:pt-16">
        <h1 className="text-[1.75rem] font-bold tracking-tight">Nothing to review right now</h1>
        <p className="text-muted-foreground">
          {tomorrow > 0 ? `${tomorrow} note${tomorrow === 1 ? "" : "s"} come${tomorrow === 1 ? "s" : ""} back tomorrow.` : "New notes come back here the day after you save them."}
        </p>
        <Button asChild size="lg" className="mt-5 h-12 rounded-xl px-5 text-base">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    )
  }

  return <ReviewSession key={round} round={round} session={session} mode="daily" />
}
