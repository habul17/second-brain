"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { ArrowRight, Check, CircleHelp, Loader2, Play, Timer, X } from "lucide-react"
import { cn } from "cn"
import { runCodeAction } from "@/actions/review"
import { CodeBlock } from "@/components/code-block"
import { CppInput } from "@/components/editor/fields"
import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { matchKeyPoints, suggestRating } from "@/lib/keypoints"
import { useSpeechRecognition } from "@/lib/speech-recognition"
import type { ReviewItem } from "@/server/review"
import type { RunResult } from "@/server/runner"
import { Checklist, PromptCard, RatingButtons, VoicePanel } from "./parts"
import type { ReviewOutcome } from "./review-session"

type Step = "pattern" | "approach" | "code" | "compare" | "followup"

const STEP_LABEL: Record<Step, string> = {
  pattern: "Pattern",
  approach: "Approach",
  code: "Code",
  compare: "Compare",
  followup: "Follow-up",
}

function shuffle<T>(list: T[]) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function useCountdown(running: boolean, minutes: number) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) return
    const start = Date.now() - elapsed * 1000
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
    // Only restart when running flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])
  const left = minutes * 60 - elapsed
  const abs = Math.abs(left)
  return { elapsed, over: left < 0, text: `${left < 0 ? "+" : ""}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}` }
}

const LAPTOP = "(min-width: 64rem)"

function subscribeLaptop(onChange: () => void) {
  const mq = window.matchMedia(LAPTOP)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

/** True on laptop-wide screens (Tailwind's lg). */
function useLaptop() {
  return useSyncExternalStore(subscribeLaptop, () => window.matchMedia(LAPTOP).matches, () => false)
}

/**
 * A DSA problem, like a real interview: read it (title hidden), name the pattern,
 * say the approach, code it against the clock, run the tests, compare with the saved solution.
 */
export function ProblemReview({ item, allPatterns, onDone }: { item: ReviewItem; allPatterns: string[]; onDone: (outcome: ReviewOutcome) => void }) {
  // Only worth asking when there's at least one wrong option to pick.
  const hasPatternStep = item.patterns.length > 0 && allPatterns.some((p) => !item.patterns.includes(p))
  const followUp = item.followUps.length ? item.followUps[item.reps % item.followUps.length] : null
  const steps: Step[] = [...(hasPatternStep ? (["pattern"] as const) : []), "approach", "code", "compare", ...(followUp ? (["followup"] as const) : [])]
  const [step, setStep] = useState<Step>(steps[0])
  // Laptop: the problem stays on the left while you work on the right. Phone: stacked.
  const split = step !== "compare" && step !== "followup"
  const laptop = useLaptop()
  const started = useRef(0)
  useEffect(() => {
    started.current = Date.now()
  }, [])

  // Pattern
  const [options] = useState(() =>
    shuffle([...item.patterns, ...shuffle(allPatterns.filter((p) => !item.patterns.includes(p))).slice(0, Math.max(2, 4 - item.patterns.length))]),
  )
  const [picked, setPicked] = useState<string | null>(null)
  const patternCorrect = hasPatternStep ? picked !== null && item.patterns.includes(picked) : null

  // Approach
  const voice = useSpeechRecognition()
  const [overrides, setOverrides] = useState<Record<number, boolean>>({})
  const heard = useMemo(() => matchKeyPoints(voice.transcript, item.keyPoints), [voice.transcript, item.keyPoints])
  const ticked = heard.map((h, i) => overrides[i] ?? h)

  // Code
  const [code, setCode] = useState(item.starterCode)
  const [run, setRun] = useState<RunResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const timer = useCountdown(step === "code", item.timeLimitMin ?? 20)

  // Rating
  const [rating, setRating] = useState<1 | 2 | 3 | null>(null)
  const [showFollowAnswer, setShowFollowAnswer] = useState(false)

  const passed = run?.results.filter((r) => r.passed).length ?? 0
  const parts = [
    ...(patternCorrect !== null ? [patternCorrect ? 1 : 0] : []),
    ...(item.keyPoints.length ? [ticked.filter(Boolean).length / item.keyPoints.length] : []),
    ...(run ? [run.compileError ? 0 : passed / Math.max(1, run.results.length)] : []),
  ]
  const score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null

  async function runTests() {
    setRunning(true)
    setRunError(null)
    try {
      const res = await runCodeAction(item.noteId, code)
      if ("error" in res) setRunError(res.error)
      else setRun(res)
    } catch {
      setRunError("Couldn't reach the runner. Check your connection.")
    } finally {
      setRunning(false)
    }
  }

  function next() {
    voice.stop()
    setStep(steps[steps.indexOf(step) + 1])
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function finish(r: 1 | 2 | 3) {
    onDone({
      rating: r,
      prompt: `Solve: ${item.title}`,
      score,
      durationMs: Date.now() - started.current,
      patternCorrect,
      testsPassed: run ? passed : null,
      testsTotal: run ? run.results.length : null,
    })
  }

  function rate(r: 1 | 2 | 3) {
    if (rating) return
    setRating(r)
    if (followUp) next()
    else finish(r)
  }

  return (
    <div className="grid gap-6">
      {/* Mini stepper */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-3 bg-border" />}
            <span className={cn("rounded-md px-2 py-1", s === step && "bg-foreground font-medium text-background", steps.indexOf(step) > i && "text-foreground")}>
              {i + 1}. {STEP_LABEL[s]}
            </span>
          </li>
        ))}
      </ol>

      <div className={cn("grid gap-6", split && "lg:grid-cols-2 lg:items-start")}>
        {step !== "followup" && (
          <details
            open={step === "pattern" || step === "approach" || (step === "code" && laptop)}
            className={cn("group rounded-3xl border bg-card", split && "lg:sticky lg:top-20 lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto")}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 sm:px-8">
              <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">Problem</span>
              <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
            </summary>
            <div className="px-6 pb-6 sm:px-8 sm:pb-8">
              <Markdown>{item.statement || "No statement saved for this problem."}</Markdown>
            </div>
          </details>
        )}

        {step === "pattern" && (
          <div className="grid gap-4">
            <div className="font-medium">Which pattern solves it?</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...options, "Not sure"].map((o) => {
                const isRight = item.patterns.includes(o)
                const chosen = picked === o
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={picked !== null}
                    onClick={() => setPicked(o)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      picked === null && "hover:border-foreground/50",
                      picked !== null && isRight && "border-foreground bg-foreground text-background",
                      chosen && !isRight && "border-dashed line-through",
                    )}
                  >
                    {picked !== null && isRight ? <Check className="size-4" /> : chosen ? <X className="size-4" /> : o === "Not sure" ? <CircleHelp className="size-4" /> : null}
                    {o}
                  </button>
                )
              })}
            </div>
            {picked !== null && (
              <>
                <p className="text-sm text-muted-foreground">
                  {patternCorrect ? "Right." : `It's ${item.patterns.join(" + ")}.`} Now say how you&apos;d solve it.
                </p>
                <Button size="lg" className="h-12 text-base" onClick={next}>
                  Next: approach <ArrowRight />
                </Button>
              </>
            )}
          </div>
        )}

        {step === "approach" && (
          <div className="grid gap-4">
            <div className="grid gap-1">
              <div className="font-medium">Say your approach out loud</div>
              <p className="text-sm text-muted-foreground">Clarify, brute force, the better idea, then time and space.</p>
            </div>
            <VoicePanel voice={voice} matched={heard} />
            <Button size="lg" className="h-12 text-base" onClick={next}>
              Next: write the code <ArrowRight />
            </Button>
          </div>
        )}

        {step === "code" && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium">Write it in C++</div>
              <span className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-sm tabular-nums", timer.over && "border-foreground bg-foreground text-background")}>
                <Timer className="size-4" /> {timer.text}
              </span>
            </div>
            <CppInput value={code} onChange={setCode} aria-label="Your code" minHeight="22rem" />
            {item.canRun && (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={runTests} disabled={running}>
                  {running ? <Loader2 className="animate-spin" /> : <Play />} Run {item.testCount} tests
                </Button>
                {run && !run.compileError && (
                  <span className="text-sm tabular-nums">
                    {passed} of {run.results.length} passed
                  </span>
                )}
              </div>
            )}
            {runError && <p className="text-sm font-medium">{runError}</p>}
            {run && <TestResults run={run} />}
            <Button size="lg" className="h-12 text-base" onClick={next}>
              Done: compare with the solution <ArrowRight />
            </Button>
          </div>
        )}

        {step === "compare" && (
          <div className="grid gap-8">
            <div className="grid gap-4 lg:grid-cols-2">
              <CodeBlock file="your code" code={code || "// (empty)"} practice={false} />
              <CodeBlock file="saved solution" code={item.solution || "// No solution saved."} practice={false} />
            </div>
            {item.keyPoints.length > 0 && (
              <div className="grid gap-3">
                <div className="text-sm font-medium text-muted-foreground">Did your approach cover these? (tap to fix)</div>
                <Checklist items={item.keyPoints} ticked={ticked} onToggle={(i) => setOverrides((o) => ({ ...o, [i]: !ticked[i] }))} />
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-sm">
              {patternCorrect !== null && <span className="rounded-lg border px-3 py-1.5">Pattern: {patternCorrect ? "right" : "missed"}</span>}
              {run && <span className="rounded-lg border px-3 py-1.5 tabular-nums">Tests: {run.compileError ? "didn't compile" : `${passed}/${run.results.length}`}</span>}
              <span className="rounded-lg border px-3 py-1.5 tabular-nums">Time: {Math.round(timer.elapsed / 60)} min</span>
            </div>
            <RatingButtons preview={item.preview} suggested={score !== null ? suggestRating(score) : null} onRate={rate} disabled={rating !== null} />
          </div>
        )}

        {step === "followup" && followUp && (
          <div className="mx-auto grid w-full max-w-2xl gap-6">
            <PromptCard label="Interviewer follow-up">
              <div className="text-xl leading-snug font-medium text-balance sm:text-2xl">
                <Markdown inline>{followUp.q}</Markdown>
              </div>
              <p className="text-sm text-muted-foreground">Answer out loud first.</p>
            </PromptCard>
            {showFollowAnswer ? (
              <>
                <PromptCard label="Answer" dark>
                  <Markdown className="text-base leading-[1.85] sm:text-lg [&_code]:bg-background/15">{followUp.a}</Markdown>
                </PromptCard>
                <Button size="lg" className="h-12 text-base" onClick={() => finish(rating!)}>
                  Next <ArrowRight />
                </Button>
              </>
            ) : (
              <Button size="lg" className="h-12 text-base" onClick={() => setShowFollowAnswer(true)}>
                Show answer
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TestResults({ run }: { run: RunResult }) {
  if (run.compileError) {
    return (
      <div className="grid gap-2 rounded-2xl border-2 border-foreground p-4">
        <span className="text-sm font-semibold">Didn&apos;t compile</span>
        <pre className="max-h-60 overflow-auto font-mono text-xs whitespace-pre-wrap">{run.compileError}</pre>
      </div>
    )
  }
  return (
    <ul className="grid gap-2">
      {run.results.map((r, i) => (
        <li key={i} className={cn("grid gap-2 rounded-xl border p-3 font-mono text-xs", !r.passed && "border-foreground")}>
          <span className="flex items-center gap-2 font-sans text-sm font-medium">
            {r.passed ? <Check className="size-4" /> : <X className="size-4" />} Test {i + 1}
          </span>
          {!r.passed && (
            <div className="grid gap-1 sm:grid-cols-3 sm:gap-3">
              <div className="grid gap-0.5">
                <span className="text-muted-foreground">input</span>
                <pre className="whitespace-pre-wrap">{r.input}</pre>
              </div>
              <div className="grid gap-0.5">
                <span className="text-muted-foreground">expected</span>
                <pre className="whitespace-pre-wrap">{r.expected}</pre>
              </div>
              <div className="grid gap-0.5">
                <span className="text-muted-foreground">got</span>
                <pre className="whitespace-pre-wrap">{r.error ?? (r.output || "(nothing)")}</pre>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
