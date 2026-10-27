"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowRight, Loader2, Play } from "lucide-react"
import { cn } from "cn"
import { runCodeAction } from "@/actions/review"
import { CppInput } from "@/components/editor/fields"
import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { matchKeyPoints, suggestRating } from "@/lib/keypoints"
import { useSpeechRecognition } from "@/lib/speech-recognition"
import type { ReviewItem } from "@/server/review"
import type { RunResult } from "@/server/runner"
import { Dock, Heading, Mark, MicButton, PlainCode, RatingButtons, Seg, Stage, Ticks } from "./parts"
import type { ReviewOutcome } from "./review-session"

type Step = "approach" | "code" | "compare" | "followup"

/** Same order on the server and in the browser (so the page hydrates), but a new order each review. */
function shuffle<T>(list: T[], seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const random = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x6d2b79f5
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296
  }
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
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

const btn = "h-12 rounded-xl text-base"

/**
 * A DSA problem, like a real interview: read it (title hidden), name the pattern and say the approach,
 * code it against the clock, then compare with the saved solution. A follow-up question last.
 * Laptop: the problem on the left, your work on the right. Phone: a switch between the two.
 */
export function ProblemReview({
  item,
  allPatterns,
  slot,
  onDone,
}: {
  item: ReviewItem
  allPatterns: string[]
  /** Where the step bar and clock go, in the session's top row. */
  slot: HTMLElement | null
  onDone: (outcome: ReviewOutcome) => void
}) {
  // Only worth asking when there's at least one wrong option to pick.
  const hasPatternStep = item.patterns.length > 0 && allPatterns.some((p) => !item.patterns.includes(p))
  const followUp = item.followUps.length ? item.followUps[item.reps % item.followUps.length] : null
  const steps: Step[] = ["approach", "code", "compare", ...(followUp ? (["followup"] as const) : [])]
  const [step, setStep] = useState<Step>("approach")
  // Phone only: which half is showing.
  const [tab, setTab] = useState<"problem" | "work">("problem")
  const [codeTab, setCodeTab] = useState<"mine" | "solution">("solution")
  const started = useRef(0)
  useEffect(() => {
    started.current = Date.now()
  }, [])

  // Pattern
  const options = useMemo(() => {
    const seed = `${item.noteId}:${item.reps}`
    const wrong = shuffle(allPatterns.filter((p) => !item.patterns.includes(p)), seed).slice(0, Math.max(2, 4 - item.patterns.length))
    return shuffle([...item.patterns, ...wrong], seed)
  }, [item, allPatterns])
  const [picked, setPicked] = useState<string | null>(null)
  const patternCorrect = hasPatternStep ? picked !== null && item.patterns.includes(picked) : null
  const choosing = hasPatternStep && picked === null

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
  const timer = useCountdown(step === "approach" || step === "code", item.timeLimitMin ?? 20)

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
    setTab("work")
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

  const top =
    slot &&
    createPortal(
      <>
        <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((s, i) => (
            <span key={s} className={cn("h-1 rounded-full", i <= steps.indexOf(step) ? "bg-foreground" : "bg-accent")} />
          ))}
        </div>
        <span className={cn("font-mono text-sm text-muted-foreground tabular-nums", timer.over && "text-bad")}>{timer.text}</span>
      </>,
      slot,
    )

  if (step === "followup" && followUp) {
    return (
      <>
        {top}
        {/* Wide like the steps before it, so the words line up with the step bar. */}
        <Stage wide>
          <div className="grid max-w-[660px] gap-7">
            <Heading sub={!showFollowAnswer && "Answer out loud first."}>
              <Markdown inline>{followUp.q}</Markdown>
            </Heading>
            {showFollowAnswer && <Markdown className="text-[1.05rem] leading-[1.8] sm:text-[1.1rem]">{followUp.a}</Markdown>}
          </div>
        </Stage>
        <Dock>
          {showFollowAnswer ? (
            <Button size="lg" className={btn} onClick={() => finish(rating!)}>
              Next <ArrowRight />
            </Button>
          ) : (
            <Button size="lg" className={btn} onClick={() => setShowFollowAnswer(true)}>
              Show answer
            </Button>
          )}
        </Dock>
      </>
    )
  }

  if (step === "compare") {
    const facts = [
      patternCorrect !== null && `Pattern ${patternCorrect ? "right" : "missed"}`,
      run && (run.compileError ? "Didn't compile" : `${passed} of ${run.results.length} tests`),
      `${Math.max(1, Math.round(timer.elapsed / 60))} min`,
    ].filter(Boolean)
    return (
      <>
        {top}
        <Stage wide>
          <Seg
            className="lg:hidden"
            options={[
              { value: "mine", label: "Your code" },
              { value: "solution", label: "Solution" },
            ]}
            value={codeTab}
            onChange={setCodeTab}
          />
          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
            <section className={cn("grid content-start gap-3 lg:pr-9", codeTab !== "mine" && "max-lg:hidden")}>
              <h2 className={colLabel}>Your code</h2>
              <PlainCode code={code || "// (empty)"} />
            </section>
            <section className={cn("grid content-start gap-3 lg:border-l lg:pl-9", codeTab !== "solution" && "max-lg:hidden")}>
              <h2 className={colLabel}>Solution</h2>
              <PlainCode code={item.solution || "// No solution saved."} />
            </section>
          </div>
          {item.keyPoints.length > 0 && <Ticks items={item.keyPoints} ticked={ticked} onToggle={(i) => setOverrides((o) => ({ ...o, [i]: !ticked[i] }))} />}
          <p className="-mt-3 text-[0.92rem] text-muted-foreground">{facts.join(" · ")}</p>
        </Stage>
        <Dock>
          <RatingButtons preview={item.preview} suggested={score !== null ? suggestRating(score) : null} onRate={rate} disabled={rating !== null} />
        </Dock>
      </>
    )
  }

  const work =
    step === "approach" ? (
      choosing ? (
        <>
          <h2 className="text-[1.35rem] leading-snug font-bold">Which pattern solves it?</h2>
          <div className="grid">
            {[...options, "Not sure"].map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setPicked(o)}
                className={cn("px-0.5 py-3.5 text-left text-[1.02rem] font-semibold transition-colors hover:bg-accent [&+&]:border-t", o === "Not sure" && "font-normal text-muted-foreground")}
              >
                {o}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {hasPatternStep && (
            <p className="flex items-center gap-2.5 text-muted-foreground">
              <Mark ok={!!patternCorrect} />
              {patternCorrect ? (
                <span>
                  <b className="font-semibold text-foreground">{picked}</b> · right
                </span>
              ) : (
                <span>
                  It&apos;s <b className="font-semibold text-foreground">{item.patterns.join(" + ")}</b>
                </span>
              )}
            </p>
          )}
          <Heading sub="Clarify, brute force, the better idea, then time and space.">Say your approach out loud</Heading>
          <MicButton voice={voice} />
        </>
      )
    ) : (
      <>
        <CppInput value={code} onChange={setCode} aria-label="Your code" minHeight="22rem" bare />
        {running && (
          <p className="flex items-center gap-2.5 text-[0.92rem] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Running tests…
          </p>
        )}
        {!running && runError && <p className="text-[0.92rem]">{runError}</p>}
        {!running && run && <TestResults run={run} />}
      </>
    )

  // The bottom bar. On a phone, while the problem is showing, it just leads to your work.
  const ready = step === "code" || !choosing
  const action =
    step === "code" ? (
      <div className="flex gap-2">
        {item.canRun && (
          <Button variant="outline" size="lg" className={btn} onClick={runTests} disabled={running}>
            <Play /> Run tests
          </Button>
        )}
        <Button size="lg" className={cn(btn, "flex-1")} onClick={next}>
          Done: compare <ArrowRight />
        </Button>
      </div>
    ) : (
      <Button size="lg" className={btn} onClick={next}>
        Next: write the code <ArrowRight />
      </Button>
    )
  const toWork = (
    <Button size="lg" className={btn} onClick={() => setTab("work")}>
      {hasPatternStep && choosing ? "Next: pick the pattern" : "Next: your approach"} <ArrowRight />
    </Button>
  )

  return (
    <>
      {top}
      <Stage wide>
        <Seg
          className="lg:hidden"
          options={[
            { value: "problem", label: "Problem" },
            { value: "work", label: step === "code" ? "Code" : "Approach" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <section
            aria-label="Problem"
            className={cn("lg:sticky lg:top-6 lg:max-h-[calc(100svh-10rem)] lg:self-start lg:overflow-y-auto lg:pr-9", tab !== "problem" && "max-lg:hidden")}
          >
            <Markdown>{item.statement || "No statement saved for this problem."}</Markdown>
          </section>
          <section className={cn("grid content-start gap-5 lg:min-h-[22rem] lg:border-l lg:pl-9", tab !== "work" && "max-lg:hidden")}>{work}</section>
        </div>
      </Stage>
      {step === "approach" && tab === "problem" && <Dock className="lg:hidden">{toWork}</Dock>}
      {ready && <Dock className={cn(step === "approach" && tab === "problem" && "max-lg:hidden")}>{action}</Dock>}
    </>
  )
}

const colLabel = "text-xs font-bold tracking-wider text-muted-foreground uppercase max-lg:hidden"

function TestResults({ run }: { run: RunResult }) {
  if (run.compileError) {
    return (
      <div className="grid gap-2">
        <p className="flex items-center gap-2.5 text-[0.92rem]">
          <Mark ok={false} /> Didn&apos;t compile
        </p>
        <pre className="max-h-60 overflow-auto font-mono text-xs whitespace-pre-wrap text-muted-foreground">{run.compileError}</pre>
      </div>
    )
  }
  const passed = run.results.filter((r) => r.passed).length
  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-2.5 text-[0.92rem] text-muted-foreground">
        <Mark ok={passed === run.results.length} /> {passed} of {run.results.length} tests passed
      </p>
      {run.results.map((r, i) =>
        r.passed ? null : (
          <div key={i} className="grid gap-1.5 border-t pt-3 font-mono text-xs">
            <span className="font-sans text-sm font-semibold">Test {i + 1}</span>
            <div className="grid gap-1 sm:grid-cols-3 sm:gap-3">
              {[
                ["input", r.input],
                ["expected", r.expected],
                ["got", r.error ?? (r.output || "(nothing)")],
              ].map(([k, v]) => (
                <div key={k} className="grid content-start gap-0.5">
                  <span className="text-muted-foreground">{k}</span>
                  <pre className="whitespace-pre-wrap">{v}</pre>
                </div>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  )
}
