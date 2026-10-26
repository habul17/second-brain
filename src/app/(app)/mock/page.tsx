import Link from "next/link"
import { ArrowRight, Code2, MessagesSquare, Swords } from "lucide-react"
import { ReviewSession } from "@/components/review/review-session"
import { buildSession, mockPick } from "@/server/review"
import { requireUser } from "@/server/session"

export const metadata = { title: "Mock interview" }

const MODES = {
  quick: { label: "Quick round", detail: "5 questions from everything you've learned", time: "about 10 min", icon: MessagesSquare },
  full: { label: "Full interview", detail: "1 coding problem, then 4 questions", time: "about 40 min", icon: Code2 },
} as const

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
      return <ReviewSession key={`${go}-${round}`} round={round} session={session} mode="mock" title="Mock interview" timed />
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-8">
      <header className="grid gap-2">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Swords className="size-7" /> Mock interview
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Random questions from all your sections, no warning about what&apos;s coming. Answer out loud, like it&apos;s real.
        </p>
      </header>
      {go && <p className="rounded-2xl border border-dashed p-4 text-sm">Not enough notes for that yet. Add a few more first.</p>}
      <div className="grid gap-4">
        {(Object.keys(MODES) as (keyof typeof MODES)[]).map((key) => {
          const m = MODES[key]
          return (
            <Link
              key={key}
              href={`/mock?go=${key}`}
              className="group flex items-center gap-5 rounded-3xl border bg-card p-6 transition-colors hover:border-foreground/40"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-foreground text-background">
                <m.icon className="size-6" />
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-lg font-semibold">{m.label}</span>
                <span className="text-sm text-muted-foreground">
                  {m.detail} · {m.time}
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
