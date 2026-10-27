"use client"

import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { Plus, X } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { RichEditor } from "./rich-editor"

const CppEditor = dynamic(() => import("./cpp-editor"), { ssr: false })

/** A part of the editor: a hairline, a small label, then the input. */
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-3 border-t pt-5", className)}>
      <div className="grid gap-1">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{label}</h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** "+ Add …" as quiet text, under a list. */
export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-10 w-fit items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
      <Plus className="size-4" /> {children}
    </button>
  )
}

/** A remove button that shows on hover (always on touch screens). */
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={onClick}
      className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
    >
      <X />
    </Button>
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
    <div ref={list} className="grid">
      {value.map((item, i) => (
        <div key={i} className="group flex items-center gap-3 border-b py-0.5">
          <span className="w-4 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{i + 1}</span>
          <input
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
            onKeyDown={(e) => onKey(e, i)}
            className="h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60"
          />
          <RemoveButton label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddButton
        onClick={() => {
          onChange([...value, ""])
          focusAt(value.length)
        }}
      >
        {addLabel}
      </AddButton>
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
    <div className="grid">
      {value.map((pair, i) => (
        <div key={keys[i] ?? `extra-${i}`} className="group grid gap-1 border-b py-3">
          <div className="flex items-start gap-3">
            <span className="mt-1 w-4 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{i + 1}</span>
            <textarea
              value={pair.q}
              placeholder={questionPlaceholder}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, q: e.target.value } : v)))}
              aria-label={`Question ${i + 1}`}
              rows={1}
              className="field-sizing-content min-w-0 flex-1 resize-none bg-transparent py-0.5 font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/60"
            />
            <RemoveButton label="Remove question" onClick={() => remove(i)} />
          </div>
          <div className="pl-7">
            <RichEditor
              compact
              bare
              value={pair.a}
              onChange={(a) => onChange(value.map((v, j) => (j === i ? { ...v, a } : v)))}
              placeholder="The answer…"
              aria-label={`Answer ${i + 1}`}
            />
          </div>
        </div>
      ))}
      <AddButton onClick={add}>{addLabel}</AddButton>
    </div>
  )
}

/** C++ code editor (CodeMirror). The box keeps its height while the editor loads. */
export function CppInput({
  value,
  onChange,
  placeholder,
  minHeight = "8rem",
  bare = false,
  "aria-label": label,
}: {
  value: string
  onChange: (code: string) => void
  placeholder?: string
  minHeight?: string
  /** No box around it (the practice screen). */
  bare?: boolean
  "aria-label"?: string
}) {
  return (
    <div
      style={{ "--min-h": minHeight } as CSSProperties}
      className={cn(
        "code-block min-h-(--min-h)",
        !bare && "overflow-hidden rounded-lg border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
      )}
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
