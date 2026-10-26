"use client"

import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { Plus, X } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RichEditor } from "./rich-editor"

const CppEditor = dynamic(() => import("./cpp-editor"), { ssr: false })

/** A labelled block in the editor with an optional one-line hint. */
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-2.5", className)}>
      <div className="grid gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {hint && <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

/** A list of short lines. Enter adds the next one, Backspace on an empty line removes it. */
export function ListInput({
  value,
  onChange,
  placeholder,
  addLabel,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  addLabel: string
}) {
  const list = useRef<HTMLDivElement>(null)

  function focusAt(i: number) {
    requestAnimationFrame(() => list.current?.querySelectorAll("input")[i]?.focus())
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter") {
      e.preventDefault()
      onChange([...value.slice(0, i + 1), "", ...value.slice(i + 1)])
      focusAt(i + 1)
    } else if (e.key === "Backspace" && value[i] === "" && value.length > 0) {
      e.preventDefault()
      onChange(value.filter((_, j) => j !== i))
      focusAt(Math.max(0, i - 1))
    }
  }

  return (
    <div ref={list} className="grid gap-2">
      {value.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
          <Input
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
            onKeyDown={(e) => onKey(e, i)}
            className="h-10"
          />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => {
          onChange([...value, ""])
          focusAt(value.length)
        }}
      >
        <Plus /> {addLabel}
      </Button>
    </div>
  )
}

export interface QA {
  q: string
  a: string
}

/** Question + answer pairs. The answer is a small rich editor. */
export function QAList({ value, onChange, addLabel, questionPlaceholder }: { value: QA[]; onChange: (next: QA[]) => void; addLabel: string; questionPlaceholder: string }) {
  // Answers are uncontrolled editors, so each pair keeps a stable key when others are removed.
  const [keys, setKeys] = useState(() => value.map((_, i) => i))

  function add() {
    setKeys((k) => [...k, Math.max(-1, ...k) + 1])
    onChange([...value, { q: "", a: "" }])
  }

  function remove(i: number) {
    setKeys((k) => k.filter((_, j) => j !== i))
    onChange(value.filter((_, j) => j !== i))
  }

  return (
    <div className="grid gap-4">
      {value.map((pair, i) => (
        <div key={keys[i] ?? `extra-${i}`} className="grid gap-3 rounded-2xl border bg-muted/30 p-3 sm:p-4">
          <div className="flex items-start gap-2">
            <span className="mt-2.5 w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
            <Textarea
              value={pair.q}
              placeholder={questionPlaceholder}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, q: e.target.value } : v)))}
              className="min-h-10 bg-card font-medium"
              rows={1}
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove question" onClick={() => remove(i)}>
              <X />
            </Button>
          </div>
          <div className="pl-7">
            <RichEditor
              compact
              value={pair.a}
              onChange={(a) => onChange(value.map((v, j) => (j === i ? { ...v, a } : v)))}
              placeholder="The answer…"
              aria-label={`Answer ${i + 1}`}
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={add}>
        <Plus /> {addLabel}
      </Button>
    </div>
  )
}

/** C++ code editor (CodeMirror). The box keeps its height while the editor loads. */
export function CppInput({
  value,
  onChange,
  placeholder,
  minHeight = "8rem",
  "aria-label": label,
}: {
  value: string
  onChange: (code: string) => void
  placeholder?: string
  minHeight?: string
  "aria-label"?: string
}) {
  return (
    <div
      style={{ "--min-h": minHeight } as CSSProperties}
      className="code-block min-h-(--min-h) overflow-hidden rounded-lg border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
    >
      <CppEditor value={value} onChange={onChange} placeholder={placeholder} label={label} />
    </div>
  )
}

/** Plain code textarea: monospace, Tab indents instead of leaving the field. */
export function CodeInput({
  value,
  onChange,
  placeholder,
  className,
  "aria-label": label,
}: {
  value: string
  onChange: (code: string) => void
  placeholder?: string
  className?: string
  "aria-label"?: string
}) {
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab" || e.shiftKey) return
    e.preventDefault()
    const el = e.currentTarget
    const { selectionStart: start, selectionEnd: end } = el
    onChange(value.slice(0, start) + "  " + value.slice(end))
    requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2))
  }

  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={label}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      className={cn("min-h-32 bg-card font-mono text-[0.84rem]! leading-relaxed", className)}
    />
  )
}
