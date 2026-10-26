"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  Code2,
  ExternalLink,
  Eye,
  EyeOff,
  Lightbulb,
  Mic,
  PartyPopper,
  Pencil,
  Radar,
  Square,
  Volume2,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"
import { CodeBlock } from "@/components/code-block"
import { Flashcards } from "@/components/flashcards"
import { Markdown, speakable } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Switch } from "@/components/ui/switch"
import { celebrate } from "@/lib/celebrate"
import { useSpeech } from "@/lib/speech"
import type { FullNote, Note } from "@/server/notes"

type StepKey = "understand" | "code" | "say" | "test"

const STEP_META: Record<StepKey, { label: string; icon: LucideIcon }> = {
  understand: { label: "Understand", icon: Lightbulb },
  code: { label: "Code", icon: Code2 },
  say: { label: "Say it", icon: Mic },
  test: { label: "Test", icon: Brain },
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
    <div className="grid grid-cols-1 gap-10">
      {/* Stepper: tabs fit their label on phone, equal widths from sm up */}
      <nav aria-label="Steps" className="flex gap-2 rounded-2xl border bg-card p-2">
        {steps.map((s, i) => {
          const { label, icon: Icon } = STEP_META[s]
          const active = i === step
          return (
            <button
              key={s}
              type="button"
              onClick={() => goTo(i)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "relative flex min-w-0 flex-auto items-center justify-center gap-2 rounded-xl px-2 py-3 text-[0.8rem] font-medium transition-colors sm:flex-1 sm:text-sm",
                active ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="step-pill"
                  className="absolute inset-0 rounded-xl bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative flex min-w-0 items-center gap-2">
                {i < step ? <Check className="hidden size-4 sm:block" /> : <Icon className="hidden size-4 sm:block" />}
                <span className="truncate">{label}</span>
              </span>
            </button>
          )
        })}
      </nav>

      {/* Step body */}
      <div className="min-h-[22rem]">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.section
            key={key}
            custom={direction}
            initial={{ opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -28 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid min-w-0 grid-cols-1 gap-8"
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

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 border-t pt-8">
        <Button variant="ghost" size="lg" onClick={() => goTo(step - 1)} disabled={step === 0}>
          <ArrowLeft /> Back
        </Button>
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <Kbd>←</Kbd>
          <Kbd>→</Kbd> to move
        </span>
        {isLast ? (
          <span />
        ) : (
          <Button size="lg" className="h-11 px-5 text-base" onClick={() => goTo(step + 1)}>
            Next: {STEP_META[steps[step + 1]].label} <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  )
}

function Empty({ noteId, what }: { noteId: string; what: string }) {
  return (
    <div className="grid justify-items-center gap-4 rounded-3xl border border-dashed px-6 py-12 text-center text-muted-foreground">
      <p>{what}</p>
      <Button asChild variant="outline">
        <Link href={`/n/${noteId}/edit`}>
          <Pencil /> Add it
        </Link>
      </Button>
    </div>
  )
}

function Label({ icon: Icon, children, className }: { icon: LucideIcon; children: string; className?: string }) {
  return (
    <div className={cn("mb-6 flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase", className)}>
      <Icon className="size-3.5" /> {children}
    </div>
  )
}

function Understand({ note, linkMap }: { note: Note; linkMap: Record<string, string> }) {
  return (
    <>
      {note.kind === "problem" && note.statement.trim() && (
        <div className="min-w-0 rounded-3xl border bg-card p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Label icon={Code2} className="mb-0">
              Problem
            </Label>
            {note.link && (
              <a
                href={note.link}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Open original <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
          <Markdown linkMap={linkMap}>{note.statement}</Markdown>
        </div>
      )}

      {note.kind === "pattern" && note.signals.length > 0 && (
        <div className="min-w-0 rounded-3xl border-2 border-foreground bg-card p-5 sm:p-8">
          <Label icon={Radar}>Reach for it when you see</Label>
          <ul className="grid gap-3">
            {note.signals.map((s, i) => (
              <li key={i} className="flex gap-3 text-base leading-relaxed sm:text-lg">
                <span className="mt-2.5 size-2 shrink-0 rounded-full bg-foreground" />
                <span>
                  <Markdown inline>{s}</Markdown>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {note.understand.trim() ? (
        <div className="min-w-0 rounded-3xl border bg-card p-5 sm:p-10">
          <Markdown linkMap={linkMap} className="text-base leading-[1.85] sm:text-[1.05rem]">
            {note.understand}
          </Markdown>
        </div>
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

      <div className="rounded-3xl border bg-card p-6 sm:p-10">
        <Label icon={Mic}>Interview answer</Label>
        <Markdown key={round} linkMap={linkMap} mode="marker" hideKeywords={practice} className="text-base leading-[1.95] sm:text-lg">
          {note.sayIt}
        </Markdown>
        {practice && (
          <p className="mt-6 text-sm text-muted-foreground">Say the full answer out loud. Tap a blank only if you get stuck.</p>
        )}
      </div>

      {note.keyPoints.length > 0 && (
        <div className="grid gap-4">
          <div className="text-sm font-medium text-muted-foreground">Key points your answer must hit</div>
          <ol className="grid gap-2.5">
            {note.keyPoints.map((k, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs text-muted-foreground">
                  {i + 1}
                </span>
                <span className="leading-relaxed">
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
