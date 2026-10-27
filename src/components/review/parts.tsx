"use client"

import { useEffect, type ReactNode } from "react"
import { highlight } from "sugar-high"
import { Check, Mic, MicOff, Square, X } from "lucide-react"
import { cn } from "cn"
import type { useSpeechRecognition } from "@/lib/speech-recognition"

type Voice = ReturnType<typeof useSpeechRecognition>

const RATINGS = [
  { value: 1, label: "Forgot" },
  { value: 2, label: "Shaky" },
  { value: 3, label: "Nailed it" },
] as const

/** Each rating's signal colour: a dot always, a tinted fill when it's the suggested one. */
const TONE = {
  1: { dot: "bg-bad", on: "border-bad bg-bad/10 ring-1 ring-bad" },
  2: { dot: "bg-okay", on: "border-okay bg-okay/10 ring-1 ring-okay" },
  3: { dot: "bg-good", on: "border-good bg-good/10 ring-1 ring-good" },
} as const

function days(n: number) {
  return n <= 1 ? "tomorrow" : n < 30 ? `in ${n} days` : `in ${Math.round(n / 30)} months`
}

/** The page under the progress bar: just the words, centred. Problems go wide on a laptop. */
export function Stage({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("mx-auto grid w-full grid-cols-[minmax(0,1fr)] content-start gap-7 px-4 pt-7 pb-10 sm:px-7", wide ? "max-w-[1120px]" : "max-w-[660px]")}>
      {children}
    </div>
  )
}

/** The one thing to do next, pinned to the bottom of the screen. */
export function Dock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-0 z-10 border-t bg-background px-4 pt-3.5 pb-[max(1.125rem,env(safe-area-inset-bottom))] sm:px-7", className)}>
      <div className="mx-auto grid w-full max-w-[664px] gap-2">{children}</div>
    </div>
  )
}

export function Heading({ children, sub, over }: { children: ReactNode; sub?: ReactNode; over?: ReactNode }) {
  return (
    <div className="grid gap-2">
      {over && <p className="-mb-1 text-[0.9rem] text-muted-foreground">{over}</p>}
      <h1 className="text-[1.4rem] leading-tight font-bold tracking-tight text-balance sm:text-[1.6rem]">{children}</h1>
      {sub && <p className="text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** Forgot / Shaky / Nailed it. Keys 1, 2, 3; Enter takes the suggested one. */
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
    <div className="grid grid-cols-3 gap-2">
      {RATINGS.map((r) => (
        <button
          key={r.value}
          type="button"
          disabled={disabled}
          title={`Comes back ${days(preview[r.value])}`}
          onClick={() => onRate(r.value)}
          className={cn(
            "flex h-[60px] flex-col items-center justify-center gap-[3px] rounded-xl border text-[0.9rem] font-bold whitespace-nowrap transition-colors disabled:opacity-50 sm:h-[52px] sm:flex-row sm:gap-2 sm:text-[0.98rem]",
            suggested === r.value ? TONE[r.value].on : "hover:bg-accent",
          )}
        >
          <span className={cn("size-2.5 shrink-0 rounded-full", TONE[r.value].dot)} />
          {r.label}
        </button>
      ))}
    </div>
  )
}

/** One round mic button. What you said shows quietly under it. */
export function MicButton({ voice }: { voice: Voice }) {
  if (!voice.supported) return null
  return (
    <div className="grid justify-items-center gap-2.5 pt-9 pb-3 text-muted-foreground">
      <button
        type="button"
        onClick={voice.listening ? voice.stop : voice.start}
        aria-label={voice.listening ? "Stop" : "Talk"}
        className="relative grid size-16 place-items-center rounded-full bg-foreground text-background transition-transform active:scale-95"
      >
        {voice.listening && <span className="absolute inset-0 animate-ping rounded-full bg-foreground/30" />}
        {voice.listening ? <Square className="size-5" /> : <Mic className="size-6" />}
      </button>
      <span aria-live="polite">{voice.listening ? "Listening… tap to stop" : voice.transcript ? "Tap to keep talking" : "Tap to talk"}</span>
      {voice.transcript && <p className="max-h-40 w-full overflow-y-auto pt-2 leading-relaxed">{voice.transcript}</p>}
      {voice.error && (
        <p className="flex items-center gap-2 text-foreground">
          <MicOff className="size-4" /> {voice.error}
        </p>
      )}
    </div>
  )
}

/** The points an answer should hit. Voice ticks them; tap to fix. */
export function Ticks({ items, ticked, onToggle }: { items: string[]; ticked: boolean[]; onToggle: (i: number) => void }) {
  return (
    <ul className="grid gap-1 border-t pt-3.5">
      {items.map((item, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onToggle(i)}
            aria-pressed={ticked[i]}
            className={cn("flex w-full items-start gap-3 py-1.5 text-left leading-relaxed", !ticked[i] && "text-muted-foreground")}
          >
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px]",
                ticked[i] ? "border-good bg-good text-white" : "border-border",
              )}
            >
              {ticked[i] && <Check className="size-3" strokeWidth={3} />}
            </span>
            {item.replace(/\*\*/g, "")}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** A small round mark: green tick or red cross. */
export function Mark({ ok }: { ok: boolean }) {
  return (
    <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-full text-white", ok ? "bg-good" : "bg-bad")}>
      {ok ? <Check className="size-[11px]" strokeWidth={3} /> : <X className="size-[11px]" strokeWidth={3} />}
    </span>
  )
}

/** Two-way switch, used on a phone to flip between the problem and your work. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cn("grid grid-cols-2 gap-1 rounded-[11px] bg-accent p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-4 py-[7px] text-[0.92rem] font-semibold text-muted-foreground transition-colors",
            value === o.value && "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Read-only code with line numbers and no box around it. */
export function PlainCode({ code }: { code: string }) {
  return (
    <pre className="code-block code-lines overflow-x-auto font-mono text-[0.78rem] leading-[1.75] sm:text-[0.84rem]">
      <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
    </pre>
  )
}
