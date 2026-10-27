"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Loader2, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { deleteNoteAction, moveNoteAction, saveNoteAction } from "@/actions/library"
import { ConfirmDelete } from "@/components/section-actions"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { backfill } from "@/lib/embedder"
import type { NoteInput } from "@/lib/note-input"
import type { TopicOption } from "@/server/topics"
import { AddButton, CodeInput, CppInput, Field, ListInput, QAList } from "./fields"
import { RichEditor } from "./rich-editor"

type Tab = "understand" | "code" | "say" | "test"

const TABS: { key: Tab; label: string }[] = [
  { key: "understand", label: "Understand" },
  { key: "code", label: "Code" },
  { key: "say", label: "Say it" },
  { key: "test", label: "Test" },
]

const KINDS = [
  { key: "concept", label: "Concept" },
  { key: "pattern", label: "Pattern" },
  { key: "problem", label: "Problem" },
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
  /** The note's topic. Changing it moves the note (or, for a new note, picks where it goes). */
  topicId?: string
  topics: TopicOption[]
  patternTitles: string[]
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

type Saved = { id: string; missingPatterns: string[] }

// A quiet picker: grey text and a chevron, no box.
const quiet = "h-auto! w-auto max-w-full gap-1.5 border-0 bg-transparent! px-2 py-1.5 text-[0.92rem] text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 dark:bg-transparent!"
const bareInput = "h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60"

/**
 * The focus writer: title, the 4 step tabs and the text, nothing else.
 * An existing note saves by itself as you type; Done (or X) closes it. A new note is added with Done.
 */
export function NoteEditor({ initial, noteId, topicId: initialTopic, topics, patternTitles }: Props) {
  const router = useRouter()
  const draftKey = `sb:draft:${noteId ?? `new:${initialTopic ?? ""}`}`
  const [input, setInput] = useState<NoteInput>(initial)
  const [topicId, setTopicId] = useState(initialTopic ?? "")
  const [tab, setTab] = useState<Tab>("understand")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(clean(initial)))
  const [deleting, setDeleting] = useState(false)
  // Bumped when a draft is restored, to remount the (uncontrolled) rich editors with the restored text.
  const [version, setVersion] = useState(0)
  const dirty = useRef(false)
  const inputRef = useRef(input)
  const savedRef = useRef(savedJson)
  // Saves run one after another, so a slow one never overwrites a newer one.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  useEffect(() => {
    inputRef.current = input
  })

  const set = <K extends keyof NoteInput>(key: K, value: NoteInput[K]) => {
    dirty.current = true
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  function forgetDraft() {
    try {
      localStorage.removeItem(draftKey)
    } catch {}
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
            forgetDraft()
          },
        },
      })
    } catch {}
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep a draft while typing, in case the save can't reach the server.
  useEffect(() => {
    if (!dirty.current) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(input))
      } catch {}
    }, 400)
    return () => clearTimeout(timer)
  }, [input, draftKey])

  // Warn before leaving with changes that aren't saved yet.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  async function saveNow(): Promise<Saved | null> {
    const data = clean(inputRef.current)
    const json = JSON.stringify(data)
    if (noteId && json === savedRef.current) return { id: noteId, missingPatterns: [] }
    if (!data.title) {
      setError("Give the note a title.")
      return null
    }
    if (!noteId && !topicId) {
      setError("Pick a topic for the note.")
      return null
    }
    setSaving(true)
    try {
      const res = await saveNoteAction(data, noteId ? { noteId } : { topicId })
      if (!res.ok) {
        setError(res.error)
        return null
      }
      setError(null)
      savedRef.current = json
      setSavedJson(json)
      if (JSON.stringify(clean(inputRef.current)) === json) {
        dirty.current = false
        forgetDraft()
      }
      return { id: res.id, missingPatterns: res.missingPatterns }
    } catch {
      setError("Couldn't save. Check your connection.")
      return null
    } finally {
      setSaving(false)
    }
  }

  function save() {
    const next = queue.current.then(saveNow)
    queue.current = next.catch(() => {})
    return next
  }

  // An existing note saves itself a moment after you stop typing.
  useEffect(() => {
    if (!noteId || !dirty.current) return
    const timer = setTimeout(() => void save(), 1200)
    return () => clearTimeout(timer)
    // save() reads the latest input through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, noteId])

  async function done() {
    const res = await save()
    if (!res) {
      document.getElementById("note-title")?.focus()
      return
    }
    void backfill()
    if (res.missingPatterns.length) toast(`No pattern note called "${res.missingPatterns.join('", "')}" yet. It links once you create it.`)
    else if (!noteId) toast("Note added. It comes up for review tomorrow.")
    router.push(`/n/${res.id}`)
  }

  // Ctrl/Cmd + S saves (or adds) from anywhere on the page.
  const doneRef = useRef(done)
  useEffect(() => {
    doneRef.current = done
  })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        void (noteId ? save() : doneRef.current())
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  async function pickTopic(id: string) {
    const previous = topicId
    setTopicId(id)
    if (!noteId) return
    try {
      await moveNoteAction(noteId, id)
      const to = topics.find((t) => t.id === id)
      toast(`Moved to ${to?.sectionName} › ${to?.path}`)
    } catch {
      setTopicId(previous)
      toast("Couldn't move the note. Check your connection.")
    }
  }

  const groups = Object.values(
    topics.reduce<Record<string, { name: string; topics: TopicOption[] }>>((acc, t) => {
      ;(acc[t.sectionId] ??= { name: t.sectionName, topics: [] }).topics.push(t)
      return acc
    }, {}),
  )
  const topic = topics.find((t) => t.id === topicId)
  const isProblem = input.kind === "problem"
  const pending = noteId !== undefined && JSON.stringify(clean(input)) !== savedJson
  const cancelHref = topic ? `/s/${topic.sectionId}` : "/"

  return (
    // data-focus hides the app's top bar; data-full lets the writer set its own spacing.
    <div data-focus data-full className="mx-auto grid w-full max-w-[740px] grid-cols-[minmax(0,1fr)] content-start gap-4 px-4 pt-3 pb-24 sm:gap-[18px] sm:px-7 sm:pt-[18px]">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {noteId ? (
          <Button variant="ghost" size="icon" aria-label="Close" onClick={done}>
            <X />
          </Button>
        ) : (
          <Button asChild variant="ghost" size="icon" aria-label="Cancel">
            <Link
              href={cancelHref}
              onClick={() => {
                dirty.current = false
                forgetDraft()
              }}
            >
              <X />
            </Link>
          </Button>
        )}
        <Select value={topicId} onValueChange={pickTopic}>
          <SelectTrigger aria-label="Topic" className={cn(quiet, "min-w-0")}>
            <span className="truncate">{topic ? `${topic.sectionName} › ${topic.path}` : "Pick a topic"}</span>
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectGroup key={g.name}>
                <SelectLabel>{g.name}</SelectLabel>
                {g.topics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.path}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <span className="flex-1" />
        {noteId && (
          <span aria-live="polite" className={cn("flex shrink-0 items-center gap-1.5 text-[0.88rem] whitespace-nowrap text-muted-foreground", error && "text-bad")}>
            {error ? (
              "Not saved"
            ) : saving || pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> <span className="max-sm:sr-only">Saving…</span>
              </>
            ) : (
              <>
                <Check className="size-3.5 text-good" /> <span className="max-sm:sr-only">Saved</span>
              </>
            )}
          </span>
        )}
        {noteId && (
          <Button variant="ghost" size="icon" aria-label="Delete note" className="text-muted-foreground" onClick={() => setDeleting(true)}>
            <Trash2 />
          </Button>
        )}
        <Button onClick={done} className="shrink-0">
          {noteId ? "Done" : "Add note"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="-mt-1 text-sm text-bad">
          {error}
        </p>
      )}

      <input
        id="note-title"
        value={input.title}
        onChange={(e) => set("title", e.target.value)}
        placeholder="Title"
        aria-label="Title"
        maxLength={160}
        autoFocus={!noteId}
        className="w-full bg-transparent text-2xl leading-[1.15] font-bold tracking-tight outline-none placeholder:text-muted-foreground/50 sm:text-[2rem]"
      />
      <Select value={input.kind} onValueChange={(v) => set("kind", v as NoteInput["kind"])}>
        <SelectTrigger aria-label="Kind of note" className={cn(quiet, "-mt-2.5 -ml-2 justify-self-start")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {KINDS.map((k) => (
            <SelectItem key={k.key} value={k.key}>
              {k.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <nav aria-label="Parts of the note" className="flex gap-4 border-b sm:gap-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn(
              "py-2.5 text-[0.92rem] font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:text-base",
              t.key === tab && "text-foreground shadow-[inset_0_-2px_0_var(--foreground)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div key={version} className="grid grid-cols-[minmax(0,1fr)] gap-8 pt-1">
        {/* Understand */}
        <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-8", tab !== "understand" && "hidden")}>
          {isProblem && (
            <RichEditor
              bare
              value={input.statement}
              onChange={(v) => set("statement", v)}
              placeholder="The problem: the question, examples and constraints. In review you only see this."
              aria-label="Problem statement"
            />
          )}
          <RichEditor
            bare
            value={input.understand}
            onChange={(v) => set("understand", v)}
            placeholder={isProblem ? "How to think about it. Type / for a heading, list, code or diagram" : "Type / for a heading, list, code or diagram"}
            aria-label="Explanation"
            className={cn(isProblem && "border-t pt-5")}
          />
          {isProblem && (
            <Field label="Details">
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
                <span className="text-muted-foreground">Difficulty</span>
                <Select value={input.difficulty ?? "none"} onValueChange={(v) => set("difficulty", v === "none" ? null : (v as NoteInput["difficulty"]))}>
                  <SelectTrigger aria-label="Difficulty" className={cn(quiet, "-ml-2 justify-self-start text-base text-foreground")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">Link</span>
                <input value={input.link ?? ""} onChange={(e) => set("link", e.target.value)} placeholder="https://leetcode.com/problems/…" aria-label="Link" className={bareInput} />
              </div>
            </Field>
          )}
          {isProblem && (
            <Field label="Patterns it uses">
              <PatternPicker value={input.patterns} options={patternTitles} onChange={(v) => set("patterns", v)} />
            </Field>
          )}
          {input.kind === "pattern" && (
            <Field label="Signals">
              <ListInput value={input.signals} onChange={(v) => set("signals", v)} placeholder='Words in a problem that point here, e.g. "longest substring"' addLabel="Add signal" />
            </Field>
          )}
        </div>

        {/* Code */}
        <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-8", tab !== "code" && "hidden")}>
          {isProblem && (
            <Field label="Solution (C++)" className="border-t-0 pt-0">
              <CppInput value={input.solution} onChange={(v) => set("solution", v)} placeholder={"class Solution {\npublic:\n  …\n};"} aria-label="Solution" minHeight="14rem" bare />
            </Field>
          )}
          <Field label={isProblem ? "Extra snippets" : "Snippets"} className={cn(!isProblem && "border-t-0 pt-0")}>
            <div className="grid grid-cols-[minmax(0,1fr)]">
              {input.code.map((snippet, i) => (
                <div key={i} className="group grid gap-2 border-b pb-6 [&+&]:pt-5">
                  <div className="flex items-center gap-2">
                    <input
                      value={snippet.file}
                      onChange={(e) => set("code", input.code.map((c, j) => (j === i ? { ...c, file: e.target.value } : c)))}
                      placeholder="File name, e.g. middleware.ts"
                      aria-label="File name"
                      className={cn(bareInput, "font-mono text-sm")}
                    />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove snippet" className="text-muted-foreground" onClick={() => set("code", input.code.filter((_, j) => j !== i))}>
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
              <AddButton onClick={() => set("code", [...input.code, { file: "", code: "", notes: [] }])}>Add snippet</AddButton>
            </div>
          </Field>
          {isProblem && <RunSetup input={input} set={set} />}
        </div>

        {/* Say it */}
        <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-8", tab !== "say" && "hidden")}>
          <RichEditor
            bare
            value={input.sayIt}
            onChange={(v) => set("sayIt", v)}
            placeholder={
              isProblem
                ? "What you say out loud: clarify, brute force, optimal, complexity, edge cases. Bold (Ctrl B) the words interviewers listen for."
                : "What you say out loud in the interview. Bold (Ctrl B) the words interviewers listen for."
            }
            aria-label="Interview answer"
          />
          <Field label="Key points">
            <ListInput value={input.keyPoints} onChange={(v) => set("keyPoints", v)} placeholder="A point your answer must hit" addLabel="Add key point" />
          </Field>
        </div>

        {/* Test */}
        <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-8", tab !== "test" && "hidden")}>
          <Field label="Questions" className="border-t-0 pt-0">
            <QAList value={input.questions} onChange={(v) => set("questions", v)} addLabel="Add question" questionPlaceholder="A question on this idea" />
          </Field>
          <Field label="Follow-ups">
            <QAList value={input.followUps} onChange={(v) => set("followUps", v)} addLabel="Add follow-up" questionPlaceholder='"Why not X?", "What if…?"' />
          </Field>
        </div>
      </div>

      {noteId && (
        <ConfirmDelete
          open={deleting}
          onOpenChange={setDeleting}
          title={`Delete "${input.title || initial.title}"?`}
          description="The note and its review history are gone for good. Links to it from other notes will show as missing."
          onConfirm={() => {
            dirty.current = false
            forgetDraft()
            return deleteNoteAction(noteId, topic?.sectionId ?? "")
          }}
        />
      )}
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
    <div className="grid gap-2">
      {options.length + extra.length > 0 && (
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
                  "rounded-lg border px-2.5 py-1 text-[0.92rem] transition-colors",
                  on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex items-center gap-2 border-b">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder="New pattern name, e.g. Sliding Window"
          aria-label="New pattern name"
          className={bareInput}
        />
        {draft.trim() && (
          <Button type="button" variant="ghost" size="sm" onClick={add}>
            Add
          </Button>
        )}
      </div>
    </div>
  )
}

function RunSetup({ input, set }: { input: NoteInput; set: <K extends keyof NoteInput>(key: K, value: NoteInput[K]) => void }) {
  const sub = "text-sm font-semibold"
  return (
    <Field label="Practice setup" hint="Lets review run your C++ against tests. Claude fills this in; you rarely need to touch it.">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <div className="grid gap-2">
          <span className={sub}>Starter code</span>
          <CppInput value={input.starterCode} onChange={(v) => set("starterCode", v)} aria-label="Starter code" bare />
        </div>
        <div className="grid gap-2">
          <span className={sub}>Test runner (main)</span>
          <CppInput value={input.harness} onChange={(v) => set("harness", v)} aria-label="Test runner" bare />
        </div>
        <div className="grid gap-2">
          <span className={sub}>Test cases</span>
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
              <Button type="button" variant="ghost" size="icon" aria-label="Remove test" className="text-muted-foreground" onClick={() => set("testCases", input.testCases.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </div>
          ))}
          <AddButton onClick={() => set("testCases", [...input.testCases, { input: "", expected: "" }])}>Add test</AddButton>
        </div>
        <div className="flex items-center gap-3">
          <span className={sub}>Time limit</span>
          <input
            type="number"
            min={1}
            max={120}
            value={input.timeLimitMin ?? ""}
            onChange={(e) => set("timeLimitMin", e.target.value ? Math.min(120, Math.max(1, Number(e.target.value))) : null)}
            placeholder="20"
            aria-label="Time limit in minutes"
            className="h-9 w-16 border-b bg-transparent text-center outline-none"
          />
          <span className="text-muted-foreground">minutes</span>
        </div>
      </div>
    </Field>
  )
}
