"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { X } from "lucide-react"
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
  round = 1,
  timed = false,
}: {
  session: Session
  mode: ReviewMode
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
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)

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
    const tally = ([3, 2, 1] as const).filter((r) => counts[r] > 0).map((r) => `${counts[r]} ${LABEL[r].toLowerCase()}`)
    return (
      <div className="mx-auto grid w-full max-w-[520px] justify-items-center gap-3 pt-10 text-center sm:pt-16">
        <h1 className="text-[1.75rem] font-bold tracking-tight">
          {mode === "mock" ? `Mock interview done in ${clock}` : mode === "practice" ? "Practice done" : "Done for today"}
        </h1>
        <p className="text-muted-foreground tabular-nums">
          {tally.join(" · ")}
          {counts[1] > 0 && mode !== "practice" && ". The ones you forgot come back tomorrow."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {mode === "mock" && (
            <Button asChild variant="outline" size="lg" className="h-12 rounded-xl px-5 text-base">
              <Link href={`/mock?go=${session.items.some((i) => i.kind === "problem") ? "full" : "quick"}&round=${round + 1}`}>Another mock</Link>
            </Button>
          )}
          {mode === "daily" && session.remaining > 0 && (
            <Button asChild variant="outline" size="lg" className="h-12 rounded-xl px-5 text-base">
              <Link href={`/review?round=${round + 1}`}>One more round ({session.remaining} due)</Link>
            </Button>
          )}
          <Button asChild size="lg" className="h-12 rounded-xl px-5 text-base">
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </div>
    )
  }

  const problem = item.kind === "problem"
  return (
    // data-focus hides the top bar; data-full lets the page use the whole width.
    <div data-focus data-full className="grid min-h-svh grid-rows-[auto_1fr]">
      <div className={cn("mx-auto flex w-full items-center gap-3.5 px-4 pt-5 sm:px-7", problem ? "max-w-[1120px]" : "max-w-[660px]")}>
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          {!problem && (
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-accent">
              <motion.div className="h-full bg-foreground" initial={false} animate={{ width: `${(index / total) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
            </div>
          )}
          {/* A problem puts its own step bar and clock here. */}
          <div ref={setSlot} className="contents" />
        </div>
        {total > 1 && (
          <span className="text-[0.9rem] whitespace-nowrap text-muted-foreground tabular-nums">
            {index + 1} of {total}
          </span>
        )}
        {timed && !problem && <span className="font-mono text-sm text-muted-foreground tabular-nums">{clock}</span>}
        <Button asChild variant="ghost" size="icon" aria-label="Stop for now" title="Stop for now. Every answer so far is saved.">
          <Link href="/">
            <X />
          </Link>
        </Button>
      </div>

      <motion.div
        key={item.noteId}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22 }}
        className="grid grid-rows-[1fr_auto]"
      >
        {problem ? (
          <ProblemReview item={item} allPatterns={session.allPatterns} slot={slot} onDone={onDone} />
        ) : (
          <ConceptReview item={item} onDone={onDone} />
        )}
      </motion.div>
    </div>
  )
}
