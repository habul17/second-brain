"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  PartyPopper,
  Pencil,
  Square,
  Volume2,
} from "lucide-react"
import { cn } from "cn"
import { CodeBlock } from "@/components/code-block"
import { Flashcards } from "@/components/flashcards"
import { Markdown, speakable } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { celebrate } from "@/lib/celebrate"
import { useSpeech } from "@/lib/speech"
import type { FullNote, Note } from "@/server/notes"

type StepKey = "understand" | "code" | "say" | "test"

const STEP_LABEL: Record<StepKey, string> = {
  understand: "Understand",
  code: "Code",
  say: "Say it",
  test: "Test",
}

interface Props {
  full: FullNote
  /** "in 3 days", worked out on the server so it matches on both sides. */
  nextReview: string
}

export function NoteView({ full, nextReview }: Props) {
  const { note, linkMap } = full
  const hasCode = note.code.length > 0 || note.solution.trim() !== ""
  const steps: StepKey[] = ["understand", ...(hasCode ? (["code"] as const) : []), "say", "test"]
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)

  function goTo(i: number) {
    if (i < 0 || i >= steps.length) return
    setDirection(i > step ? 1 : -1)
    setStep(i)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return
      if (document.querySelector("[role=dialog]")) return
      if (e.key === "ArrowRight") goTo(step + 1)
      if (e.key === "ArrowLeft") goTo(step - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const key = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="grid grid-cols-1 gap-[18px]">
      {/* Stepper: four numbered segments; the numbers drop on a phone so the labels fit. */}
      <nav aria-label="Steps" className="flex gap-1.5 rounded-xl border bg-card p-[5px]">
        {steps.map((s, i) => {
          const active = i === step
          return (
            <button
              key={s}
              type="button"
              onClick={() => goTo(i)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "relative flex h-[38px] min-w-0 flex-1 items-center justify-center rounded-lg px-1 text-[0.82rem] font-semibold whitespace-nowrap transition-colors sm:px-2 sm:text-[0.92rem]",
                active ? "text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="step-pill"
                  className="absolute inset-0 rounded-lg bg-foreground"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative flex min-w-0 items-center gap-2">
                <span className="hidden size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-current text-[0.7rem] sm:grid">
                  {i < step ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className="truncate">{STEP_LABEL[s]}</span>
              </span>
            </button>
          )
        })}
      </nav>

      {/* Step body */}
      <div className="min-h-[22rem] pt-2">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.section
            key={key}
            custom={direction}
            initial={{ opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -28 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid min-w-0 grid-cols-1 gap-7"
          >
            {key === "understand" && <Understand note={note} linkMap={linkMap} />}
            {key === "code" && <CodeStep note={note} />}
            {key === "say" && <SayIt note={note} linkMap={linkMap} />}
            {key === "test" && (
              <Flashcards
                cards={[
                  ...note.questions.map((c) => ({ ...c, label: "Question" })),
                  ...note.followUps.map((c) => ({ ...c, label: "Interviewer follow-up" })),
                ]}
                linkMap={linkMap}
                onFinish={() => celebrate()}
                finished={(r) => (
                  <div className="grid justify-items-center gap-6 rounded-3xl border-2 border-foreground bg-card px-7 py-14 text-center">
                    <div className="grid size-14 place-items-center rounded-full bg-foreground text-background">
                      <PartyPopper className="size-7" />
                    </div>
                    <div className="grid gap-1">
                      <div className="text-2xl font-semibold">You went through it all</div>
                      <div className="text-muted-foreground">
                        You knew {r.firstTry} of {r.total} on the first try. Next review: {nextReview}.
                      </div>
                    </div>
                    <Button asChild size="lg" className="h-11 px-5 text-base">
                      <Link href={`/s/${full.section.id}#t-${full.topic.id}`}>
                        Back to {full.topic.name} <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                )}
              />
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      {/* Next bar: sticks to the bottom so Next is always in reach on long notes. */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t bg-background/90 pt-3 pb-[max(1.125rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0} className="px-2 text-muted-foreground">
          <ArrowLeft /> Back
        </Button>
        {!isLast && (
          <Button onClick={() => goTo(step + 1)}>
            Next: {STEP_LABEL[steps[step + 1]]} <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  )
}

function Empty({ noteId, what }: { noteId: string; what: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
      <p>{what}</p>
      <Button asChild variant="outline" size="sm">
        <Link href={`/n/${noteId}/edit`}>
          <Pencil /> Add it
        </Link>
      </Button>
    </div>
  )
}

function Label({ children, className }: { children: string; className?: string }) {
  return <div className={cn("mb-3 text-xs font-bold tracking-wider text-muted-foreground uppercase", className)}>{children}</div>
}

function Understand({ note, linkMap }: { note: Note; linkMap: Record<string, string> }) {
  return (
    <>
      {note.kind === "problem" && note.statement.trim() && (
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <Label>Problem</Label>
            {note.link && (
              <a
                href={note.link}
                target="_blank"
                rel="noreferrer noopener"
                className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Open original <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
          <Markdown linkMap={linkMap} className="max-w-[65ch]">
            {note.statement}
          </Markdown>
        </div>
      )}

      {note.kind === "pattern" && note.signals.length > 0 && (
        <div className="min-w-0">
          <Label>Reach for it when you see</Label>
          <ul className="grid max-w-[65ch] gap-2">
            {note.signals.map((s, i) => (
              <li key={i} className="flex gap-3 leading-relaxed">
                <span className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-foreground" />
                <span>
                  <Markdown inline>{s}</Markdown>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {note.understand.trim() ? (
        <Markdown linkMap={linkMap} className="max-w-[65ch] min-w-0">
          {note.understand}
        </Markdown>
      ) : (
        <Empty noteId={note.id} what="No explanation yet." />
      )}
    </>
  )
}

function CodeStep({ note }: { note: Note }) {
  return (
    <div className="grid gap-8">
      {note.code.map((snippet, i) => (
        <CodeBlock key={i} file={snippet.file} code={snippet.code} notes={snippet.notes} />
      ))}
      {note.kind === "problem" && note.solution.trim() && <CodeBlock file="solution.cpp" code={note.solution} />}
      {note.kind === "problem" && note.testCases.length > 0 && (
        <div className="grid gap-3">
          <div className="text-sm font-medium text-muted-foreground">Test cases</div>
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b bg-muted/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Input</th>
                  <th className="px-4 py-2.5 font-medium">Expected</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {note.testCases.map((t, i) => (
                  <tr key={i} className="align-top">
                    <td className="px-4 py-2.5 whitespace-pre-wrap">{t.input}</td>
                    <td className="px-4 py-2.5 whitespace-pre-wrap">{t.expected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SayIt({ note, linkMap }: { note: Note; linkMap: Record<string, string> }) {
  const [practice, setPractice] = useState(false)
  const [round, setRound] = useState(0)
  const { supported, speaking, speak, stop } = useSpeech()

  if (!note.sayIt.trim()) return <Empty noteId={note.id} what="No interview answer yet." />

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {supported ? (
          <Button variant="outline" size="lg" onClick={() => (speaking ? stop() : speak(speakable(note.sayIt)))}>
            {speaking ? <Square /> : <Volume2 />} {speaking ? "Stop" : "Listen"}
          </Button>
        ) : (
          <span />
        )}
        <label htmlFor="hide-keywords" className="flex cursor-pointer items-center gap-2.5 text-sm">
          {practice ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-muted-foreground" />}
          Hide key words
          <Switch
            id="hide-keywords"
            checked={practice}
            onCheckedChange={(on) => {
              setPractice(on)
              setRound((r) => r + 1)
            }}
          />
        </label>
      </div>

      <div className="min-w-0">
        <Markdown key={round} linkMap={linkMap} mode="marker" hideKeywords={practice} className="max-w-[65ch] leading-[1.9]">
          {note.sayIt}
        </Markdown>
        {practice && <p className="mt-5 text-sm text-muted-foreground">Say the full answer out loud. Tap a blank only if you get stuck.</p>}
      </div>

      {note.keyPoints.length > 0 && (
        <div className="min-w-0">
          <Label>Key points your answer must hit</Label>
          <ol className="grid max-w-[65ch]">
            {note.keyPoints.map((k, i) => (
              <li key={i} className="flex items-baseline gap-3 border-b py-2.5 leading-relaxed last:border-b-0">
                <span className="w-4 shrink-0 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                <span>
                  <Markdown inline>{k}</Markdown>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}
