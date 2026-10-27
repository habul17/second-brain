import Link from "next/link"
import { ArrowRight, Check, ChevronRight, Flame, Layers, Plug } from "lucide-react"
import { cn } from "cn"
import { MockSheet, WeakSheet } from "@/components/home/practice-sheets"
import { NewSectionRow } from "@/components/home/new-section-row"
import { Button } from "@/components/ui/button"
import { SectionIcon, sectionIcons } from "@/lib/icons"
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

function heat(n: number) {
  if (n === 0) return "bg-muted"
  if (n < 5) return "bg-foreground/25"
  if (n < 15) return "bg-foreground/55"
  return "bg-foreground"
}

const label = "text-[0.8rem] font-semibold tracking-wider text-muted-foreground uppercase"

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const user = await requireUser()
  const settings = await getSettings(user.id)
  const [sections, plan, due, stats, weak, params] = await Promise.all([
    listSectionsWithCounts(user.id),
    todayPlan(user.id, settings.dailyMinutes),
    dueSummary(user.id),
    activity(user.id, settings.timezone),
    weakSpots(user.id, 30),
    searchParams,
  ])
  const totalNotes = sections.reduce((sum, s) => sum + s.noteCount, 0)
  const icons = sectionIcons(sections)
  // The last four weeks, two rows of fourteen days. Hidden until there is something to show.
  const recent = stats.cells.slice(-28)
  const reviewedRecently = recent.some((c) => c.n > 0)

  return (
    <div className="mx-auto grid w-full max-w-[680px] grid-cols-[minmax(0,1fr)] gap-9">
      <h1 className="text-[1.75rem] font-bold tracking-tight">{greeting(settings.timezone)}</h1>

      <section aria-labelledby="today" className="grid gap-[18px] rounded-[18px] border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="grid gap-1">
            <h2 id="today" className={label}>
              Today
            </h2>
            {plan.count > 0 ? (
              <>
                <p className="text-2xl font-bold tabular-nums">{plural(plan.count, "note")} to review</p>
                <p className="text-[0.92rem] leading-normal text-muted-foreground tabular-nums">
                  About {plan.minutes} minutes. Say each answer out loud.
                </p>
              </>
            ) : totalNotes === 0 ? (
              <>
                <p className="text-2xl font-bold">Nothing to review yet</p>
                <p className="max-w-md text-[0.92rem] leading-normal text-muted-foreground">
                  Save your first note. It comes back here tomorrow, then again just before you would forget it.
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-2xl font-bold">
                  <Check className="size-6 text-good" /> All done for today
                </p>
                <p className="text-[0.92rem] text-muted-foreground tabular-nums">
                  {due.tomorrow > 0 ? `${plural(due.tomorrow, "note")} coming up tomorrow.` : "Nothing due tomorrow either."}
                </p>
              </>
            )}
          </div>
          {plan.count > 0 ? (
            <Button asChild size="lg" className="h-12 rounded-xl px-[22px] text-base">
              <Link href="/review">
                <Layers /> Start review <ArrowRight />
              </Link>
            </Button>
          ) : totalNotes === 0 ? (
            <Button asChild variant="outline" size="lg" className="h-12 rounded-xl">
              <Link href="/settings?open=claude">
                <Plug /> Connect Claude
              </Link>
            </Button>
          ) : null}
        </div>

        {/* Other ways to practice: findable, but quieter than Start review. */}
        {totalNotes > 0 && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <MockSheet startOpen={params.open === "mock"} tooFew={params.few === "1"} />
            {weak.length > 0 && <WeakSheet notes={weak} startOpen={params.open === "weak"} />}
          </div>
        )}
      </section>

      <section aria-labelledby="sections" className="grid gap-2.5">
        <h2 id="sections" className={label}>
          Sections
        </h2>
        <ul className="overflow-hidden rounded-[14px] border">
          {sections.map((s) => (
            <li key={s.id} className="border-b last:border-b-0">
              <Link href={`/s/${s.id}`} className="flex min-h-15 items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-accent">
                <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-foreground text-background">
                  <SectionIcon icon={icons[s.id]} className="size-[18px]" />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-[1.02rem] font-bold">{s.name}</span>
                  <span className="text-[0.86rem] text-muted-foreground tabular-nums">{plural(s.noteCount, "note")}</span>
                </span>
                {s.dueCount > 0 && (
                  <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums">{s.dueCount} due</span>
                )}
                <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
          <li>
            <NewSectionRow />
          </li>
        </ul>
      </section>

      {reviewedRecently && (
        <section aria-label="Your streak" className="flex flex-wrap items-center gap-x-[18px] gap-y-3 text-[0.9rem] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Flame className="size-[18px]" />
            <span>
              <b className="text-foreground tabular-nums">{stats.streak}</b>-day streak
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="size-[18px]" />
            <span>
              <b className="text-foreground tabular-nums">{stats.reviewedToday}</b> reviewed today
            </span>
          </span>
          <span
            className="grid grid-flow-col grid-cols-[repeat(14,12px)] grid-rows-[repeat(2,12px)] gap-[3px]"
            role="img"
            aria-label={`${recent.reduce((sum, c) => sum + c.n, 0)} reviews in the last 4 weeks`}
          >
            {recent.map((c) => (
              <span key={c.day} title={`${c.day}: ${c.n}`} className={cn("rounded-[3px]", heat(c.n))} />
            ))}
          </span>
        </section>
      )}
    </div>
  )
}
