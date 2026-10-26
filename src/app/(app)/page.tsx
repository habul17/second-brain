import Link from "next/link"
import { ArrowRight, Check, Flame, Layers, Plug, Swords } from "lucide-react"
import { Heatmap } from "@/components/heatmap"
import { NewSectionCard } from "@/components/home/new-section-card"
import { Button } from "@/components/ui/button"
import { KIND_ICON, SectionIcon } from "@/lib/icons"
import { recentNotes } from "@/server/notes"
import { todayPlan } from "@/server/review"
import { listSectionsWithCounts } from "@/server/sections"
import { requireUser } from "@/server/session"
import { getSettings } from "@/server/settings"
import { activity, dueSummary, weakSpots } from "@/server/stats"

export const metadata = { title: "Home" }

function greeting(timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone }).format(new Date()))
  if (hour < 5) return "Up late"
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export default async function HomePage() {
  const user = await requireUser()
  const settings = await getSettings(user.id)
  const [sections, plan, due, stats, recent, weak] = await Promise.all([
    listSectionsWithCounts(user.id),
    todayPlan(user.id, settings.dailyMinutes),
    dueSummary(user.id),
    activity(user.id, settings.timezone),
    recentNotes(user.id),
    weakSpots(user.id, 30),
  ])
  const totalNotes = sections.reduce((sum, s) => sum + s.noteCount, 0)
  const firstName = user.name.split(/\s+/)[0]
  // No streak or heatmap until there is something to show.
  const reviewedRecently = stats.cells.some((c) => c.n > 0)

  return (
    <div className="grid gap-10 sm:gap-14">
      <header className="grid gap-2">
        <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
          {greeting(settings.timezone)}, {firstName}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">Your second brain</h1>
      </header>

      {/* Today's review: first on phone, after the sections from sm up */}
      <section aria-labelledby="today" className="grid gap-6 rounded-3xl border bg-card p-5 sm:order-1 sm:gap-8 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="grid gap-1.5">
            <h2 id="today" className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Today&apos;s review
            </h2>
            {plan.count > 0 ? (
              <>
                <p className="text-2xl font-semibold tabular-nums">{plural(plan.count, "note")} to review</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  About {plan.minutes} minutes. Say each answer out loud.
                  {plan.later > 0 && ` ${plan.later} more after that if you want.`}
                </p>
              </>
            ) : totalNotes === 0 ? (
              <>
                <p className="text-2xl font-semibold">Nothing to review yet</p>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  Save your first note. It comes back here tomorrow, then again just before you would forget it.
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-2xl font-semibold">
                  <Check className="size-6" /> All done for today
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {due.tomorrow > 0 ? `${plural(due.tomorrow, "note")} coming up tomorrow.` : "Nothing due tomorrow either."}
                </p>
              </>
            )}
          </div>
          {plan.count > 0 ? (
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link href="/review">
                <Layers /> Start review <ArrowRight />
              </Link>
            </Button>
          ) : totalNotes === 0 ? (
            <Button asChild variant="outline" size="lg" className="h-11">
              <Link href="/settings#claude">
                <Plug /> Connect Claude
              </Link>
            </Button>
          ) : null}
        </div>

        {/* Other ways to practice: findable, but quieter than Start review. */}
        {totalNotes > 0 && (
          <div className="-mt-2 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/mock">
                <Swords /> Mock interview
              </Link>
            </Button>
            {weak.length > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href="/weak">
                  <Flame /> Weak spots <span className="text-muted-foreground tabular-nums">{weak.length}</span>
                </Link>
              </Button>
            )}
          </div>
        )}

        {reviewedRecently && (
          <div className="grid gap-6 border-t pt-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-10 sm:pt-8">
            <div className="flex gap-8 sm:grid sm:content-start sm:gap-6">
              <div className="grid gap-0.5">
                <span className="flex items-center gap-2 text-3xl font-semibold tabular-nums">
                  <Flame className="size-6" /> {stats.streak}
                </span>
                <span className="text-sm text-muted-foreground">day streak</span>
              </div>
              <div className="grid gap-0.5">
                <span className="text-3xl font-semibold tabular-nums">{stats.reviewedToday}</span>
                <span className="text-sm text-muted-foreground">reviewed today</span>
              </div>
            </div>
            <Heatmap cells={stats.cells} />
          </div>
        )}
      </section>

      {/* Sections */}
      <section aria-labelledby="sections" className="grid gap-4 sm:gap-5">
        <h2 id="sections" className="text-sm font-medium text-muted-foreground">
          Sections
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {sections.map((s) => {
            return (
              <Link
                key={s.id}
                href={`/s/${s.id}`}
                className="group flex items-center gap-4 rounded-3xl border bg-card p-4 transition-colors hover:border-foreground/40 sm:grid sm:min-h-40 sm:content-between sm:gap-6 sm:p-6"
              >
                {/* "contents" on phone: icon, text and badge sit in one row */}
                <div className="contents sm:flex sm:items-start sm:justify-between sm:gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-foreground text-background sm:size-11">
                    <SectionIcon name={s.name} className="size-5" />
                  </span>
                  {s.dueCount > 0 && (
                    <span className="order-last shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-xs tabular-nums sm:order-none">
                      {s.dueCount} due
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 items-end justify-between gap-3">
                  <div className="grid min-w-0 gap-0.5 sm:gap-1">
                    <span className="truncate text-lg font-semibold">{s.name}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {plural(s.topicCount, "topic")} · {plural(s.noteCount, "note")}
                    </span>
                  </div>
                  <ArrowRight className="hidden size-5 shrink-0 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 sm:block" />
                </div>
              </Link>
            )
          })}
          <NewSectionCard />
        </div>
      </section>

      {/* Recently added */}
      {recent.length > 0 && (
        <section aria-labelledby="recent" className="grid gap-5 sm:order-2">
          <h2 id="recent" className="text-sm font-medium text-muted-foreground">
            Recently added
          </h2>
          <ul className="grid divide-y rounded-3xl border bg-card">
            {recent.map((n) => {
              const Icon = KIND_ICON[n.kind]
              return (
                <li key={n.id}>
                  <Link href={`/n/${n.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 sm:px-6">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate font-medium">{n.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {n.sectionName} › {n.topicName}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
