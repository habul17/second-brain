"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Brain, Code2, FileText, Lightbulb, Loader2, Mic, Plus, Puzzle, Save, X, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { saveNoteAction } from "@/actions/library"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { backfill } from "@/lib/embedder"
import { KIND_ICON } from "@/lib/icons"
import type { NoteInput } from "@/lib/note-input"
import type { TopicOption } from "@/server/topics"
import { CodeInput, Field, ListInput, QAList } from "./fields"
import { RichEditor } from "./rich-editor"

type Tab = "understand" | "code" | "say" | "test"

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: "understand", label: "Understand", icon: Lightbulb },
  { key: "code", label: "Code", icon: Code2 },
  { key: "say", label: "Say it", icon: Mic },
  { key: "test", label: "Test", icon: Brain },
]

const KINDS = [
  { key: "concept", label: "Concept", hint: "Any idea" },
  { key: "pattern", label: "Pattern", hint: "DSA technique" },
  { key: "problem", label: "Problem", hint: "DSA question" },
] as const

export const EMPTY_NOTE: NoteInput = {
  kind: "concept",
  title: "",
  understand: "",
  code: [],
  sayIt: "",
  keyPoints: [],
  questions: [],
  followUps: [],
  signals: [],
  statement: "",
  difficulty: null,
  link: null,
  patterns: [],
  starterCode: "",
  solution: "",
  harness: "",
  testCases: [],
  timeLimitMin: null,
}

interface Props {
  initial: NoteInput
  noteId?: string
  /** Where a new note goes. Editing keeps the note where it is (use "Move to…" on the note). */
  topicId?: string
  topics: TopicOption[]
  patternTitles: string[]
}

function filled(input: NoteInput, tab: Tab) {
  if (tab === "understand") return input.understand.trim() !== "" || input.statement.trim() !== ""
  if (tab === "code") return input.code.length > 0 || input.solution.trim() !== ""
  if (tab === "say") return input.sayIt.trim() !== ""
  return input.questions.length > 0
}

/** Drops blank rows the user added but never filled. */
function clean(input: NoteInput): NoteInput {
  const qa = (list: NoteInput["questions"]) => list.filter((p) => p.q.trim() && p.a.trim())
  const lines = (list: string[]) => list.map((s) => s.trim()).filter(Boolean)
  return {
    ...input,
    title: input.title.trim(),
    keyPoints: lines(input.keyPoints),
    signals: lines(input.signals),
    patterns: lines(input.patterns),
    questions: qa(input.questions),
    followUps: qa(input.followUps),
    code: input.code.filter((c) => c.code.trim()).map((c) => ({ ...c, file: c.file.trim() || "snippet", notes: lines(c.notes ?? []) })),
    testCases: input.testCases.filter((t) => t.input.trim() || t.expected.trim()),
    link: input.link?.trim() || null,
  }
}

export function NoteEditor({ initial, noteId, topicId: initialTopic, topics, patternTitles }: Props) {
  const router = useRouter()
  const draftKey = `sb:draft:${noteId ?? `new:${initialTopic ?? ""}`}`
  const [input, setInput] = useState<NoteInput>(initial)
  const [topicId, setTopicId] = useState(initialTopic ?? "")
  const [tab, setTab] = useState<Tab>("understand")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped when a draft is restored, to remount the (uncontrolled) rich editors with the restored text.
  const [version, setVersion] = useState(0)
  const dirty = useRef(false)

  const set = <K extends keyof NoteInput>(key: K, value: NoteInput[K]) => {
    dirty.current = true
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  // Offer back any unsaved draft from last time (e.g. the tab was closed by accident).
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(draftKey)
    } catch {}
    if (!saved || saved === JSON.stringify(initial)) return
    try {
      const draft = JSON.parse(saved) as NoteInput
      // Browser storage only exists after mount, so this can't be initial state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInput(draft)
      setVersion((v) => v + 1)
      dirty.current = true
      toast("Restored your unsaved changes", {
        action: {
          label: "Discard",
          onClick: () => {
            setInput(initial)
            setVersion((v) => v + 1)
            dirty.current = false
            try {
              localStorage.removeItem(draftKey)
            } catch {}
          },
        },
      })
    } catch {}
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep a draft while typing.
  useEffect(() => {
    if (!dirty.current) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(input))
      } catch {}
    }, 400)
    return () => clearTimeout(timer)
  }, [input, draftKey])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  async function save() {
    if (saving) return
    const data = clean(input)
    if (!data.title) {
      setError("Give the note a title.")
      document.getElementById("note-title")?.focus()
      return
    }
    if (!noteId && !topicId) {
      setError("Pick a topic for the note.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await saveNoteAction(data, noteId ? { noteId } : { topicId })
      if (!res.ok) {
        setError(res.error)
        return
      }
      dirty.current = false
      try {
        localStorage.removeItem(draftKey)
      } catch {}
      if (res.missingPatterns.length) {
        toast(`Saved. No pattern note called "${res.missingPatterns.join('", "')}" yet. It links once you create it.`)
      } else {
        toast(noteId ? "Saved" : "Note added. It comes up for review tomorrow.")
      }
      void backfill()
      router.push(`/n/${res.id}`)
    } catch {
      setError("Couldn't save. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  // Ctrl/Cmd + S saves from anywhere on the page.
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const groups = Object.values(
    topics.reduce<Record<string, { name: string; topics: TopicOption[] }>>((acc, t) => {
      ;(acc[t.sectionId] ??= { name: t.sectionName, topics: [] }).topics.push(t)
      return acc
    }, {}),
  )
  const isProblem = input.kind === "problem"
  const cancelHref = noteId ? `/n/${noteId}` : topicId ? `/s/${topics.find((t) => t.id === topicId)?.sectionId ?? ""}` : "/"

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      {/* Top: where it goes, and its title */}
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">{noteId ? "Edit note" : "New note"}</span>
          {!noteId && (
            <Select value={topicId} onValueChange={setTopicId}>
              <SelectTrigger className="h-9 w-full sm:w-72" aria-label="Topic">
                <SelectValue placeholder="Pick a topic…" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectGroup key={g.name}>
                    <SelectLabel>{g.name}</SelectLabel>
                    {g.topics.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <input
          id="note-title"
          value={input.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Title, e.g. How JWT auth works"
          maxLength={160}
          autoFocus={!noteId}
          className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 sm:text-4xl"
        />
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of note">
          {KINDS.map((k) => {
            const Icon = KIND_ICON[k.key]
            const on = input.kind === k.key
            return (
              <button
                key={k.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set("kind", k.key)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                  on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="font-medium">{k.label}</span>
                <span className={cn("hidden text-xs sm:inline", on ? "text-background/60" : "text-muted-foreground")}>{k.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabs, same look as the note's steps */}
      <nav aria-label="Parts of the note" className="sticky top-[4.5rem] z-20 flex gap-2 rounded-2xl border bg-card/95 p-2 backdrop-blur">
        {TABS.map((t) => {
          const active = t.key === tab
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-1 py-2.5 text-[0.8rem] font-medium transition-colors sm:text-sm",
                active ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {active && (
                <motion.span layoutId="editor-tab" className="absolute inset-0 rounded-xl bg-primary" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
              )}
              <span className="relative flex items-center gap-2">
                <t.icon className="hidden size-4 sm:block" />
                <span className="truncate">{t.label}</span>
                {filled(input, t.key) && <span className={cn("size-1.5 rounded-full", active ? "bg-primary-foreground" : "bg-foreground")} />}
              </span>
            </button>
          )
        })}
      </nav>

      <div key={version} className="grid gap-10">
        {/* Understand */}
        <div className={cn("grid gap-10", tab !== "understand" && "hidden")}>
          {isProblem && (
            <>
              <Field label="Problem statement" hint="The full question with examples and constraints. In review you only see this.">
                <RichEditor value={input.statement} onChange={(v) => set("statement", v)} placeholder="Given an array of integers nums and an integer target…" aria-label="Problem statement" />
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Difficulty">
                  <Select value={input.difficulty ?? "none"} onValueChange={(v) => set("difficulty", v === "none" ? null : (v as NoteInput["difficulty"]))}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Link">
                  <Input value={input.link ?? ""} onChange={(e) => set("link", e.target.value)} placeholder="https://leetcode.com/problems/…" className="h-10" />
                </Field>
              </div>
              <Field label="Patterns it uses" hint="Tap a pattern you already have, or type a new name.">
                <PatternPicker value={input.patterns} options={patternTitles} onChange={(v) => set("patterns", v)} />
              </Field>
            </>
          )}
          {input.kind === "pattern" && (
            <Field label="Signals" hint='Words in a problem that should make you think of this pattern, e.g. "longest substring without…".'>
              <ListInput value={input.signals} onChange={(v) => set("signals", v)} placeholder="contiguous subarray with a condition" addLabel="Add signal" />
            </Field>
          )}
          <Field
            label={isProblem ? "How to think about it" : "Explanation"}
            hint="Everything you need to fully get it in one read: analogy, steps, tables, diagrams. Link notes with [[Note title]]."
          >
            <RichEditor value={input.understand} onChange={(v) => set("understand", v)} aria-label="Explanation" />
          </Field>
        </div>

        {/* Code */}
        <div className={cn("grid gap-10", tab !== "code" && "hidden")}>
          {isProblem && (
            <Field label="Solution (C++)" hint="The full accepted solution. Shown side by side with yours after you practice.">
              <CodeInput value={input.solution} onChange={(v) => set("solution", v)} placeholder={"class Solution {\npublic:\n  …\n};"} aria-label="Solution" className="min-h-56" />
            </Field>
          )}
          <Field label={isProblem ? "Extra snippets" : "Code"} hint="Short snippets worth typing out yourself, each with one line per important part.">
            <div className="grid gap-6">
              {input.code.map((snippet, i) => (
                <div key={i} className="grid gap-3 rounded-2xl border bg-muted/30 p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      value={snippet.file}
                      onChange={(e) => set("code", input.code.map((c, j) => (j === i ? { ...c, file: e.target.value } : c)))}
                      placeholder="file name, e.g. middleware.ts"
                      className="h-9 bg-card font-mono text-xs!"
                    />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove snippet" onClick={() => set("code", input.code.filter((_, j) => j !== i))}>
                      <X />
                    </Button>
                  </div>
                  <CodeInput value={snippet.code} onChange={(v) => set("code", input.code.map((c, j) => (j === i ? { ...c, code: v } : c)))} aria-label="Code" />
                  <ListInput
                    value={snippet.notes ?? []}
                    onChange={(v) => set("code", input.code.map((c, j) => (j === i ? { ...c, notes: v } : c)))}
                    placeholder="What this part does"
                    addLabel="Add line note"
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => set("code", [...input.code, { file: "", code: "", notes: [] }])}>
                <Plus /> Add snippet
              </Button>
            </div>
          </Field>
          {isProblem && <RunSetup input={input} set={set} />}
        </div>

        {/* Say it */}
        <div className={cn("grid gap-10", tab !== "say" && "hidden")}>
          <Field
            label="Interview answer"
            hint={
              isProblem
                ? "What you say out loud: clarify → brute force → optimal → code → dry run → complexity → edge cases. Bold the words interviewers listen for."
                : "What you say out loud, strong enough to impress a FAANG interviewer. Bold (Ctrl B) the words interviewers listen for."
            }
          >
            <RichEditor value={input.sayIt} onChange={(v) => set("sayIt", v)} aria-label="Interview answer" />
          </Field>
          <Field label="Key points" hint="3 to 7 short points your spoken answer must hit. Review checks your answer against these.">
            <ListInput value={input.keyPoints} onChange={(v) => set("keyPoints", v)} placeholder="Stateless: server keeps no session" addLabel="Add key point" />
          </Field>
        </div>

        {/* Test */}
        <div className={cn("grid gap-10", tab !== "test" && "hidden")}>
          <Field label="Questions" hint="3 or 4 questions on this idea, each from a different angle. Review picks a different one each time.">
            <QAList value={input.questions} onChange={(v) => set("questions", v)} addLabel="Add question" questionPlaceholder="What problem does a JWT solve?" />
          </Field>
          <Field label="Interviewer follow-ups" hint='"Why not X?", "What if…?", "How would it scale?"'>
            <QAList value={input.followUps} onChange={(v) => set("followUps", v)} addLabel="Add follow-up" questionPlaceholder="How do you log a user out with JWTs?" />
          </Field>
        </div>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 z-20 -mx-4 flex items-center gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        {error ? (
          <p role="alert" className="min-w-0 flex-1 text-sm font-medium">
            {error}
          </p>
        ) : (
          <span className="hidden min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Kbd>/</Kbd> blocks · <Kbd>Ctrl S</Kbd> save
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button asChild variant="ghost">
            <Link
              href={cancelHref}
              onClick={() => {
                dirty.current = false
                try {
                  localStorage.removeItem(draftKey)
                } catch {}
              }}
            >
              Cancel
            </Link>
          </Button>
          <Button onClick={save} disabled={saving} className="px-5">
            {saving ? <Loader2 className="animate-spin" /> : <Save />} {noteId ? "Save" : "Add note"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PatternPicker({ value, options, onChange }: { value: string[]; options: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("")
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase())
  const extra = value.filter((v) => !options.some((o) => o.toLowerCase() === v.toLowerCase()))

  function add() {
    const t = draft.trim()
    if (t && !has(t)) onChange([...value, t])
    setDraft("")
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {[...options, ...extra].map((t) => {
          const on = has(t)
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v.toLowerCase() !== t.toLowerCase()) : [...value, t])}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Puzzle className="size-3.5" /> {t}
            </button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder="New pattern name, e.g. Sliding Window"
          className="h-9"
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
          <Plus /> Add
        </Button>
      </div>
    </div>
  )
}

function RunSetup({ input, set }: { input: NoteInput; set: <K extends keyof NoteInput>(key: K, value: NoteInput[K]) => void }) {
  return (
    <div className="grid gap-8 rounded-3xl border border-dashed p-4 sm:p-6">
      <div className="grid gap-1">
        <span className="flex items-center gap-2 font-semibold">
          <FileText className="size-4" /> Practice setup
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          Lets review run your C++ against tests. Claude fills this in for you; you rarely need to touch it.
        </span>
      </div>
      <Field label="Starter code" hint="What you start from in review, e.g. the empty class Solution.">
        <CodeInput value={input.starterCode} onChange={(v) => set("starterCode", v)} aria-label="Starter code" />
      </Field>
      <Field label="Test runner (main)" hint="C++ main() added after your code. Reads one test from input, prints the answer.">
        <CodeInput value={input.harness} onChange={(v) => set("harness", v)} aria-label="Test runner" />
      </Field>
      <Field label="Test cases" hint="Input given to the program, and the exact output expected.">
        <div className="grid gap-3">
          {input.testCases.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
              <CodeInput
                value={t.input}
                onChange={(v) => set("testCases", input.testCases.map((c, j) => (j === i ? { ...c, input: v } : c)))}
                placeholder="input"
                className="min-h-16"
                aria-label={`Test ${i + 1} input`}
              />
              <CodeInput
                value={t.expected}
                onChange={(v) => set("testCases", input.testCases.map((c, j) => (j === i ? { ...c, expected: v } : c)))}
                placeholder="expected output"
                className="min-h-16"
                aria-label={`Test ${i + 1} expected output`}
              />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove test" onClick={() => set("testCases", input.testCases.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => set("testCases", [...input.testCases, { input: "", expected: "" }])}>
            <Plus /> Add test
          </Button>
        </div>
      </Field>
      <Field label="Time limit (minutes)" hint="How long you get to code it in review.">
        <Input
          type="number"
          min={1}
          max={120}
          value={input.timeLimitMin ?? ""}
          onChange={(e) => set("timeLimitMin", e.target.value ? Math.min(120, Math.max(1, Number(e.target.value))) : null)}
          placeholder="20"
          className="h-10 w-32"
        />
      </Field>
    </div>
  )
}
