import Link from "next/link"
import { ArrowRight, Dumbbell, Flame, Sprout } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KIND_ICON } from "@/lib/icons"
import { requireUser } from "@/server/session"
import { weakSpots } from "@/server/stats"

export const metadata = { title: "Weak spots" }

export default async function WeakSpotsPage() {
  const user = await requireUser()
  const weak = await weakSpots(user.id, 30)

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <Flame className="size-7" /> Weak spots
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            The notes you keep forgetting. A few minutes here is the best use of your time before an interview.
          </p>
        </div>
        {weak.length > 0 && (
          <Button asChild size="lg" className="h-11 px-5">
            <Link href={`/practice?notes=${weak.slice(0, 10).map((w) => w.id).join(",")}`}>
              <Dumbbell /> Practice {Math.min(10, weak.length)} now
            </Link>
          </Button>
        )}
      </header>

      {weak.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-3xl border border-dashed px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-muted">
            <Sprout className="size-6" />
          </span>
          <div className="grid max-w-sm gap-1.5">
            <p className="text-lg font-semibold">No weak spots yet</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Notes show up here when you forget them more than once. Keep doing your daily review.
            </p>
          </div>
        </div>
      ) : (
        <ul className="grid divide-y overflow-hidden rounded-3xl border bg-card">
          {weak.map((w) => {
            const Icon = KIND_ICON[w.kind]
            return (
              <li key={w.id}>
                <Link href={`/n/${w.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 sm:px-6">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">{w.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {w.sectionName} › {w.topicName}
                      <span className="sm:hidden"> · {w.reason}</span>
                    </span>
                  </span>
                  <span className="hidden shrink-0 rounded-md border px-2 py-0.5 text-xs sm:inline">{w.reason}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
