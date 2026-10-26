"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Home, PartyPopper, RotateCcw, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { submitReviewAction } from "@/actions/review"
import { Button } from "@/components/ui/button"
import { celebrate } from "@/lib/celebrate"
import type { ReviewMode } from "@/db/schema"
import type { ReviewSession as Session } from "@/server/review"
import { ConceptReview } from "./concept-review"
import { ProblemReview } from "./problem-review"

export interface ReviewOutcome {
  rating: 1 | 2 | 3
  prompt: string
  score: number | null
  durationMs: number
  patternCorrect: boolean | null
  testsPassed: number | null
  testsTotal: number | null
}

const LABEL = { 1: "Forgot", 2: "Shaky", 3: "Nailed it" } as const

function useElapsed(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!running) return
    const start = Date.now()
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [running])
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

export function ReviewSession({
  session: initial,
  mode,
  title,
  round = 1,
  timed = false,
}: {
  session: Session
  mode: ReviewMode
  title: string
  round?: number
  /** Show a running clock (mock interviews). */
  timed?: boolean
}) {
  // Saving an answer refreshes the page data (so the top bar count drops), which sends a new
  // session here. Keep the one we started with until the round ends.
  const [session] = useState(initial)
  const [index, setIndex] = useState(0)
  const [counts, setCounts] = useState({ 1: 0, 2: 0, 3: 0 })
  const total = session.items.length
  const item = session.items[index]
  const done = index >= total
  const clock = useElapsed(timed && !done)

  useEffect(() => {
    if (done && total > 0) celebrate()
  }, [done, total])

  function onDone(outcome: ReviewOutcome) {
    const current = session.items[index]
    setCounts((c) => ({ ...c, [outcome.rating]: c[outcome.rating] + 1 }))
    setIndex((i) => i + 1)
    window.scrollTo({ top: 0 })
    submitReviewAction({ noteId: current.noteId, mode, ...outcome }).catch(() =>
      toast(`Couldn't save your answer for "${current.title}". It will come up again.`),
    )
  }

  if (done) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-6">
        <div className="grid justify-items-center gap-6 rounded-3xl border-2 border-foreground bg-card px-7 py-14 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-foreground text-background">
            <PartyPopper className="size-7" />
          </div>
          <div className="grid gap-2">
            <div className="text-2xl font-semibold">
              {mode === "mock" ? `Mock interview done in ${clock}` : mode === "practice" ? "Practice done" : "Done for today"}
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-sm text-muted-foreground tabular-nums">
              {([3, 2, 1] as const).map((r) => (
                <span key={r} className="rounded-lg border px-2.5 py-1">
                  {LABEL[r]}: {counts[r]}
                </span>
              ))}
            </div>
            {counts[1] > 0 && <p className="text-sm text-muted-foreground">The ones you forgot come back tomorrow.</p>}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {mode === "mock" && (
              <Button asChild variant="outline" size="lg">
                <Link href={`/mock?go=${session.items.some((i) => i.kind === "problem") ? "full" : "quick"}&round=${round + 1}`}>
                  <RotateCcw /> Another mock
                </Link>
              </Button>
            )}
            {mode === "daily" && session.remaining > 0 && (
              <Button asChild variant="outline" size="lg">
                <Link href={`/review?round=${round + 1}`}>
                  <RotateCcw /> One more round ({session.remaining} due)
                </Link>
              </Button>
            )}
            <Button asChild size="lg" className="h-11 px-5 text-base">
              <Link href="/">
                <Home /> Back home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    // data-focus hides the top bar (globals.css). Problems go wide on laptop: problem on the left, your work on the right.
    <div data-focus className={cn("mx-auto grid w-full max-w-2xl grid-cols-1 gap-8", item.kind === "problem" && "lg:max-w-none")}>
      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            {title} · {item.kind === "problem" ? item.sectionName : `${item.sectionName} › ${item.topicName}`}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {timed && <span className="rounded-md border px-2 py-0.5 font-mono text-sm tabular-nums">{clock}</span>}
            <span className="font-mono text-sm tabular-nums">
              {index + 1} / {total}
            </span>
            <Button asChild variant="ghost" size="icon" aria-label="Stop for now">
              <Link href="/">
                <X />
              </Link>
            </Button>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div className="h-full bg-foreground" initial={false} animate={{ width: `${(index / total) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={item.noteId} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          {item.kind === "problem" ? (
            <ProblemReview item={item} allPatterns={session.allPatterns} onDone={onDone} />
          ) : (
            <ConceptReview item={item} onDone={onDone} />
          )}
        </motion.div>
      </AnimatePresence>

      {index === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Need a break? Tap X. Every answer so far is saved.
        </p>
      )}
    </div>
  )
}
