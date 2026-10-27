"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { boldWords, matchKeyPoints, suggestRating } from "@/lib/keypoints"
import { useSpeechRecognition } from "@/lib/speech-recognition"
import type { ReviewItem } from "@/server/review"
import { Dock, Heading, MicButton, RatingButtons, Stage, Ticks } from "./parts"
import type { ReviewOutcome } from "./review-session"

interface Prompt {
  /** Saved with the review, so the history says what was asked. */
  question: string
  /** What the screen shows: the note's title for "explain it", else the question. */
  heading: string
  answer: string
  /** What the spoken answer should cover. */
  checks: string[]
}

/** Rotates through "explain it" and each question, so you can't just memorise one answer. */
export function pickPrompt(item: ReviewItem): Prompt {
  const explain: Prompt | null = item.sayIt.trim()
    ? {
        question: item.kind === "pattern" ? `What is ${item.title}, and when do you reach for it?` : `Explain "${item.title}" like you would in an interview.`,
        heading: item.kind === "pattern" ? `What is ${item.title}, and when do you reach for it?` : item.title,
        answer: item.sayIt,
        checks: item.keyPoints.length ? item.keyPoints : boldWords(item.sayIt),
      }
    : null
  const questions: Prompt[] = item.questions.map((q) => ({ question: q.q, heading: q.q, answer: q.a, checks: boldWords(q.a) }))
  const all = [...(explain ? [explain] : []), ...questions]
  if (!all.length) {
    const question = `What do you know about "${item.title}"?`
    return { question, heading: question, answer: "This note has no answer yet. Add one from the note page.", checks: [] }
  }
  return all[item.reps % all.length]
}

const ANSWER = "text-[1.05rem] leading-[1.8] sm:text-[1.1rem]"

export function ConceptReview({ item, onDone }: { item: ReviewItem; onDone: (outcome: ReviewOutcome) => void }) {
  const prompt = useMemo(() => pickPrompt(item), [item])
  const followUp = item.followUps.length > 0 && item.reps % 2 === 1 ? item.followUps[Math.floor(item.reps / 2) % item.followUps.length] : null
  const voice = useSpeechRecognition()
  const [phase, setPhase] = useState<"ask" | "answer" | "followup" | "followup-answer">("ask")
  const [overrides, setOverrides] = useState<Record<number, boolean>>({})
  const [rating, setRating] = useState<1 | 2 | 3 | null>(null)
  const started = useRef(0)

  useEffect(() => {
    started.current = Date.now()
  }, [])

  const heard = useMemo(() => matchKeyPoints(voice.transcript, prompt.checks), [voice.transcript, prompt.checks])
  const ticked = heard.map((h, i) => overrides[i] ?? h)
  const score = prompt.checks.length ? ticked.filter(Boolean).length / prompt.checks.length : null
  const usedVoice = voice.transcript.length > 0 || Object.keys(overrides).length > 0
  const suggested = score !== null && usedVoice ? suggestRating(score) : null

  function reveal() {
    voice.stop()
    setPhase("answer")
  }

  function finish(r: 1 | 2 | 3) {
    onDone({ rating: r, prompt: prompt.question, score, durationMs: Date.now() - started.current, patternCorrect: null, testsPassed: null, testsTotal: null })
  }

  function rate(r: 1 | 2 | 3) {
    if (rating) return
    setRating(r)
    if (followUp && r >= 2) setPhase("followup")
    else finish(r)
  }

  // Space shows the answer (when not typing or using the mic button). Enter moves on after a follow-up.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target !== document.body) return
      if (e.key === " " && phase === "ask") {
        e.preventDefault()
        reveal()
      } else if ((e.key === " " || e.key === "Enter") && phase === "followup") {
        e.preventDefault()
        setPhase("followup-answer")
      } else if (e.key === "Enter" && phase === "followup-answer" && rating) finish(rating)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (phase === "followup" || phase === "followup-answer") {
    return (
      <>
        <Stage>
          <Heading sub={phase === "followup" && "Answer out loud first."}>
            <Markdown inline>{followUp!.q}</Markdown>
          </Heading>
          {phase === "followup-answer" && <Markdown className={ANSWER}>{followUp!.a}</Markdown>}
        </Stage>
        <Dock>
          {phase === "followup" ? (
            <Button size="lg" className="h-12 rounded-xl text-base" onClick={() => setPhase("followup-answer")}>
              Show answer
            </Button>
          ) : (
            <Button size="lg" className="h-12 rounded-xl text-base" onClick={() => finish(rating!)}>
              Next <ArrowRight />
            </Button>
          )}
        </Dock>
      </>
    )
  }

  return (
    <>
      <Stage>
        <Heading sub={phase === "ask" && "Say it out loud."} over={prompt.heading !== item.title && item.title}>
          <Markdown inline>{prompt.heading}</Markdown>
        </Heading>
        {phase === "ask" ? (
          <MicButton voice={voice} />
        ) : (
          <>
            <Markdown className={ANSWER}>{prompt.answer}</Markdown>
            {item.kind === "pattern" && item.signals.length > 0 && (
              <p className="-mt-3 text-muted-foreground">Signals: {item.signals.join(" · ")}</p>
            )}
            {prompt.checks.length > 0 && (
              <Ticks items={prompt.checks} ticked={ticked} onToggle={(i) => setOverrides((o) => ({ ...o, [i]: !ticked[i] }))} />
            )}
          </>
        )}
      </Stage>
      <Dock>
        {phase === "ask" ? (
          <Button size="lg" className="h-12 rounded-xl text-base" onClick={reveal}>
            Show answer
          </Button>
        ) : (
          <RatingButtons preview={item.preview} suggested={suggested} onRate={rate} disabled={rating !== null} />
        )}
      </Dock>
    </>
  )
}
