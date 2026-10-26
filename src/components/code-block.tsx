"use client"

import { useState } from "react"
import { highlight } from "sugar-high"
import { Check, Copy, FileCode2, Keyboard } from "lucide-react"
import { Markdown } from "@/components/markdown"

interface Props {
  file: string
  code: string
  notes?: string[]
  /** Show "type it, don't paste" (practice code) instead of a copy button. */
  practice?: boolean
}

export function CodeBlock({ file, code, notes = [], practice = true }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="code-block min-w-0 overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/60 px-5 py-2.5">
        <span className="flex min-w-0 items-center gap-2 font-mono text-xs font-medium">
          <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{file}</span>
        </span>
        {practice ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Keyboard className="size-3.5" /> type it, don&apos;t paste
          </span>
        ) : (
          <button type="button" onClick={copy} className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <pre className="overflow-x-auto px-5 py-5 font-mono text-[0.86rem] leading-[1.8]">
        <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </pre>
      {notes.length > 0 && (
        <ul className="grid gap-2.5 border-t px-5 py-4 text-sm leading-relaxed text-muted-foreground">
          {notes.map((note, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/50" />
              <span className="min-w-0">
                <Markdown inline>{note}</Markdown>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
