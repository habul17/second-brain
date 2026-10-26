"use client"

import { useEffect, type ReactNode } from "react"
import { motion } from "motion/react"
import { Check, Mic, MicOff, Square } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import type { useSpeechRecognition } from "@/lib/speech-recognition"

type Voice = ReturnType<typeof useSpeechRecognition>

export const RATINGS = [
  { value: 1, label: "Forgot", hint: "Didn't get it" },
  { value: 2, label: "Shaky", hint: "Got some of it" },
  { value: 3, label: "Nailed it", hint: "Could say it in an interview" },
] as const

/** Each rating's signal colour: a dot always, a tinted fill when it's the suggested one. */
const TONE = {
  1: { dot: "bg-bad", on: "border-bad bg-bad/10 ring-1 ring-bad" },
  2: { dot: "bg-okay", on: "border-okay bg-okay/15 ring-1 ring-okay" },
  3: { dot: "bg-good", on: "border-good bg-good/10 ring-1 ring-good" },
} as const

function days(n: number) {
  return n <= 1 ? "tomorrow" : n < 30 ? `in ${n} days` : `in ${Math.round(n / 30)} mo`
}

/** Forgot / Shaky / Nailed it, each showing when the note comes back. Keys 1, 2, 3. */
export function RatingButtons({
  preview,
  suggested,
  onRate,
  disabled,
}: {
  preview: Record<1 | 2 | 3, number>
  suggested: 1 | 2 | 3 | null
  onRate: (rating: 1 | 2 | 3) => void
  disabled?: boolean
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable || disabled) return
      if (e.key === "1" || e.key === "2" || e.key === "3") onRate(Number(e.key) as 1 | 2 | 3)
      if (e.key === "Enter" && suggested) onRate(suggested)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onRate, suggested, disabled])

  return (
    <div className="grid gap-3">
      <div className="text-sm font-medium text-muted-foreground">
        How did it go?{suggested && " Suggested: the outlined one. Change it if it's wrong."}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {RATINGS.map((r) => {
          const on = suggested === r.value
          return (
            <button
              key={r.value}
              type="button"
              disabled={disabled}
              onClick={() => onRate(r.value)}
              className={cn(
                "grid gap-1 rounded-2xl border px-2 py-3.5 text-center transition-colors disabled:opacity-50 sm:px-4 sm:py-4",
                on ? TONE[r.value].on : "bg-card hover:border-foreground/50",
              )}
            >
              <span className="flex items-center justify-center gap-2 text-sm font-semibold sm:text-base">
                <span className={cn("size-2 shrink-0 rounded-full", TONE[r.value].dot)} />
                {r.label}
                <Kbd className="hidden sm:inline-flex">{r.value}</Kbd>
              </span>
              <span className="text-xs text-muted-foreground">{days(preview[r.value])}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The mic button, what you said so far, and how many points you've hit (without giving them away). */
export function VoicePanel({ voice, matched }: { voice: Voice; matched: boolean[] }) {
  const hits = matched.filter(Boolean).length

  if (!voice.supported) {
    return (
      <p className="rounded-2xl border border-dashed p-4 text-sm leading-relaxed text-muted-foreground">
        Say your answer out loud, then show the answer and tick what you covered. (Voice check works in Chrome, Edge and Safari.)
      </p>
    )
  }

  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {voice.listening ? (
          <Button variant="outline" size="lg" onClick={voice.stop}>
            <Square /> Stop
          </Button>
        ) : (
          <Button size="lg" className="h-11 px-5" onClick={voice.start}>
            <Mic /> {voice.transcript ? "Keep talking" : "Start answering"}
          </Button>
        )}
        {matched.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <span className="flex gap-1">
              {matched.map((m, i) => (
                <motion.span
                  key={i}
                  className={cn("size-2.5 rounded-full", m ? "bg-foreground" : "bg-muted-foreground/25")}
                  animate={m ? { scale: [1, 1.5, 1] } : {}}
                />
              ))}
            </span>
            <span className="tabular-nums">
              {hits} of {matched.length} points
            </span>
          </div>
        )}
      </div>
      {voice.listening && !voice.transcript && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-foreground" />
          </span>
          Listening… start talking.
        </p>
      )}
      {voice.transcript && <p className="max-h-40 overflow-y-auto text-sm leading-relaxed text-muted-foreground">{voice.transcript}</p>}
      {voice.error && (
        <p className="flex items-center gap-2 text-sm">
          <MicOff className="size-4" /> {voice.error}
        </p>
      )}
    </div>
  )
}

/** Key points with tick boxes: auto-ticked by voice, and you can fix them by tapping. */
export function Checklist({ items, ticked, onToggle }: { items: string[]; ticked: boolean[]; onToggle: (i: number) => void }) {
  return (
    <ul className="grid gap-2">
      {items.map((item, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onToggle(i)}
            aria-pressed={ticked[i]}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
              ticked[i] ? "border-foreground bg-card" : "border-dashed text-muted-foreground hover:border-foreground/40",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border",
                ticked[i] ? "border-foreground bg-foreground text-background" : "border-muted-foreground/50",
              )}
            >
              {ticked[i] && <Check className="size-3.5" />}
            </span>
            <span className="leading-relaxed">{item.replace(/\*\*/g, "")}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function PromptCard({ label, children, dark = false }: { label: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className={cn("grid gap-5 rounded-3xl border p-6 sm:p-9", dark ? "border-foreground bg-foreground text-background" : "bg-card")}>
      <span className={cn("font-mono text-xs font-semibold tracking-wider uppercase", dark ? "text-background/60" : "text-muted-foreground")}>{label}</span>
      {children}
    </div>
  )
}
