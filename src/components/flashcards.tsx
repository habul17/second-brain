"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, RotateCcw } from "lucide-react"
import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"

export interface Flashcard {
  q: string
  a: string
  /** Small label on the card, e.g. "Follow-up". */
  label?: string
}

export interface DeckResult {
  total: number
  firstTry: number
}

interface Props {
  cards: Flashcard[]
  linkMap?: Record<string, string>
  onFinish?: (result: DeckResult) => void
  /** What to show once every card is known. */
  finished: (result: DeckResult) => ReactNode
}

/** Flip cards. "Not yet" sends a card to the back of the deck until you know it. */
export function Flashcards({ cards, linkMap, onFinish, finished }: Props) {
  const [queue, setQueue] = useState(() => cards.map((_, i) => i))
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [missed, setMissed] = useState<Set<number>>(() => new Set())
  const [known, setKnown] = useState<Set<number>>(() => new Set())
  const [result, setResult] = useState<DeckResult | null>(null)
  const cardRef = useRef<HTMLButtonElement>(null)

  const current = queue[pos]

  function answer(knewIt: boolean) {
    if (!flipped || result) return
    let nextQueue = queue
    const nextMissed = new Set(missed)
    if (knewIt) setKnown((k) => new Set(k).add(current))
    else {
      nextMissed.add(current)
      setMissed(nextMissed)
      nextQueue = [...queue, current]
      setQueue(nextQueue)
    }
    setFlipped(false)
    if (pos + 1 >= nextQueue.length) {
      const r = { total: cards.length, firstTry: cards.length - nextMissed.size }
      setResult(r)
      onFinish?.(r)
    } else {
      setPos(pos + 1)
      requestAnimationFrame(() => cardRef.current?.focus())
    }
  }

  function restart() {
    setQueue(cards.map((_, i) => i))
    setPos(0)
    setFlipped(false)
    setMissed(new Set())
    setKnown(new Set())
    setResult(null)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (result) return
      const el = e.target as HTMLElement | null
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return
      if (e.key === " " && (e.target === document.body || e.target === cardRef.current)) {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (e.key === "1") answer(false)
      else if (e.key === "2") answer(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (cards.length === 0) {
    return <p className="rounded-3xl border border-dashed p-8 text-center text-muted-foreground">No questions on this note yet.</p>
  }

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        {finished(result)}
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" onClick={restart}>
            <RotateCcw /> Test me again
          </Button>
        </div>
      </motion.div>
    )
  }

  const card = cards[current]

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          Card {Math.min(pos + 1, queue.length)} of {queue.length}
        </span>
        <span className="flex items-center gap-1.5 tabular-nums">
          <Check className="size-3.5 text-foreground" /> {known.size} / {cards.length} known
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pos}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22 }}
          className="flip-scene"
        >
          <motion.button
            ref={cardRef}
            type="button"
            onClick={(e) => {
              // Let links inside the answer work without flipping the card back.
              if ((e.target as HTMLElement).closest("a")) return
              setFlipped((f) => !f)
            }}
            aria-label={flipped ? "Show question" : "Show answer"}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            style={{ transformStyle: "preserve-3d" }}
            className="grid w-full rounded-3xl text-left outline-none [grid-template-areas:'stack'] focus-visible:ring-4 focus-visible:ring-ring/40"
          >
            <div className="flip-face flex min-h-72 flex-col justify-between gap-8 rounded-3xl border bg-card p-7 shadow-sm [grid-area:stack] sm:p-10">
              <span className="font-mono text-xs font-semibold tracking-wider uppercase">{card.label ?? "Question"}</span>
              <div className="text-lg leading-snug font-medium text-balance sm:text-xl">
                <Markdown inline linkMap={linkMap}>
                  {card.q}
                </Markdown>
              </div>
              <span className="text-sm text-muted-foreground">
                Answer out loud, then tap to flip <Kbd className="ml-1">Space</Kbd>
              </span>
            </div>
            <div className="flip-face flex min-h-72 [transform:rotateY(180deg)] flex-col justify-between gap-8 rounded-3xl border border-foreground bg-foreground p-7 text-background shadow-sm [grid-area:stack] sm:p-10">
              <span className="font-mono text-xs font-semibold tracking-wider text-background/60 uppercase">Answer</span>
              <Markdown linkMap={linkMap} className="text-base leading-[1.85] sm:text-lg [&_code]:bg-background/15 [&_pre]:text-foreground">
                {card.a}
              </Markdown>
              <span className="text-sm text-background/60">Be honest. Did you know it?</span>
            </div>
          </motion.button>
        </motion.div>
      </AnimatePresence>

      {/* One step at a time: flip first, then say how it went. */}
      {flipped ? (
        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" size="lg" className="h-12 border-bad/60 text-base hover:bg-bad/10" onClick={() => answer(false)}>
            <RotateCcw className="text-bad" /> Not yet <Kbd className="ml-1 hidden sm:inline-flex">1</Kbd>
          </Button>
          <Button variant="outline" size="lg" className="h-12 border-good/60 text-base hover:bg-good/10" onClick={() => answer(true)}>
            <Check className="text-good" /> Knew it <Kbd className="ml-1 hidden sm:inline-flex">2</Kbd>
          </Button>
        </div>
      ) : (
        <Button size="lg" className="h-12 text-base" onClick={() => setFlipped(true)}>
          Show answer <Kbd className="ml-1 hidden bg-background/20 text-background sm:inline-flex">Space</Kbd>
        </Button>
      )}
    </div>
  )
}
