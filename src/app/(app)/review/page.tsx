import Link from "next/link"
import { CalendarCheck, Home } from "lucide-react"
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
      <div className="mx-auto grid w-full max-w-xl justify-items-center gap-6 rounded-3xl border bg-card px-7 py-14 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-muted">
          <CalendarCheck className="size-7" />
        </div>
        <div className="grid gap-1.5">
          <h1 className="text-2xl font-semibold">Nothing to review right now</h1>
          <p className="text-muted-foreground">
            {tomorrow > 0 ? `${tomorrow} note${tomorrow === 1 ? "" : "s"} come${tomorrow === 1 ? "s" : ""} back tomorrow.` : "New notes come back here the day after you save them."}
          </p>
        </div>
        <Button asChild size="lg" className="h-11 px-5">
          <Link href="/">
            <Home /> Back home
          </Link>
        </Button>
      </div>
    )
  }

  return <ReviewSession key={round} round={round} session={session} mode="daily" title="Today's review" />
}
