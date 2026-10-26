"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Eye } from "lucide-react"
import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { boldWords, matchKeyPoints, suggestRating } from "@/lib/keypoints"
import { useSpeechRecognition } from "@/lib/speech-recognition"
import type { ReviewItem } from "@/server/review"
import { Checklist, PromptCard, RatingButtons, VoicePanel } from "./parts"
import type { ReviewOutcome } from "./review-session"

interface Prompt {
  label: string
  question: string
  answer: string
  /** What the spoken answer should cover. */
  checks: string[]
}

/** Rotates through "explain it" and each question, so you can't just memorise one answer. */
export function pickPrompt(item: ReviewItem): Prompt {
  const explain: Prompt | null = item.sayIt.trim()
    ? {
        label: "Explain it",
        question: item.kind === "pattern" ? `What is ${item.title}, and when do you reach for it?` : `Explain "${item.title}" like you would in an interview.`,
        answer: item.sayIt,
        checks: item.keyPoints.length ? item.keyPoints : boldWords(item.sayIt),
      }
    : null
  const questions: Prompt[] = item.questions.map((q) => ({ label: "Question", question: q.q, answer: q.a, checks: boldWords(q.a) }))
  const all = [...(explain ? [explain] : []), ...questions]
  if (!all.length) return { label: "Recall", question: `What do you know about "${item.title}"?`, answer: "This note has no answer yet. Add one from the note page.", checks: [] }
  return all[item.reps % all.length]
}

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

  // Space shows the answer (when not typing or using the mic button).
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
      <div className="grid gap-6">
        <PromptCard label="Interviewer follow-up">
          <div className="text-xl leading-snug font-medium text-balance sm:text-2xl">
            <Markdown inline>{followUp!.q}</Markdown>
          </div>
          <p className="text-sm text-muted-foreground">Answer out loud first. This one doesn&apos;t change your score.</p>
        </PromptCard>
        {phase === "followup" ? (
          <Button size="lg" className="h-12 text-base" onClick={() => setPhase("followup-answer")}>
            <Eye /> Show answer <Kbd className="ml-1 bg-background/20 text-background">Space</Kbd>
          </Button>
        ) : (
          <>
            <PromptCard label="Answer" dark>
              <Markdown className="text-base leading-[1.85] sm:text-lg [&_code]:bg-background/15">{followUp!.a}</Markdown>
            </PromptCard>
            <Button size="lg" className="h-12 text-base" onClick={() => finish(rating!)}>
              Next <ArrowRight /> <Kbd className="ml-1 bg-background/20 text-background">Enter</Kbd>
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <PromptCard label={prompt.label}>
        <div className="text-xl leading-snug font-medium text-balance sm:text-2xl">
          <Markdown inline>{prompt.question}</Markdown>
        </div>
        {phase === "ask" && <p className="text-sm text-muted-foreground">Answer out loud, like you&apos;re in the interview.</p>}
      </PromptCard>

      {phase === "ask" ? (
        <>
          <VoicePanel voice={voice} matched={heard} />
          <Button variant={voice.transcript ? "default" : "outline"} size="lg" className="h-12 text-base" onClick={reveal}>
            <Eye /> Show answer <Kbd className="ml-1 hidden sm:inline-flex">Space</Kbd>
          </Button>
        </>
      ) : (
        <>
          <PromptCard label="Answer" dark>
            <Markdown className="text-base leading-[1.85] sm:text-lg [&_code]:bg-background/15 [&_pre]:text-foreground">{prompt.answer}</Markdown>
            {item.kind === "pattern" && item.signals.length > 0 && (
              <div className="grid gap-2 border-t border-background/20 pt-4 text-sm">
                <span className="text-background/60">Signals</span>
                <ul className="grid gap-1">
                  {item.signals.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </PromptCard>

          {prompt.checks.length > 0 && (
            <div className="grid gap-3">
              <div className="text-sm font-medium text-muted-foreground">
                {voice.supported ? "What you covered (tap to fix)" : "Tick what you said"}
              </div>
              <Checklist items={prompt.checks} ticked={ticked} onToggle={(i) => setOverrides((o) => ({ ...o, [i]: !ticked[i] }))} />
            </div>
          )}

          {voice.transcript && (
            <details className="rounded-xl border px-4 py-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">What you said</summary>
              <p className="mt-2 leading-relaxed">{voice.transcript}</p>
            </details>
          )}

          <RatingButtons preview={item.preview} suggested={suggested} onRate={rate} disabled={rating !== null} />
        </>
      )}
    </div>
  )
}
