"use client"

import { useEffect, useRef } from "react"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { TableKit } from "@tiptap/extension-table"
import { Placeholder } from "@tiptap/extensions"
import { Markdown } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"
import { cn } from "cn"
import { SlashCommand } from "./slash-command"

// Plain text that looks like Markdown (headings, lists, bold, links, tables, code fences).
const LOOKS_LIKE_MARKDOWN = /(^|\n)(#{1,6} |[-*+] |\d+\. |> |```|\|.*\|)|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\n]+\)/

interface Props {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  /** Smaller, for answers and short fields. */
  compact?: boolean
  /** No box around it: just the words (the focus writer). */
  bare?: boolean
  className?: string
  "aria-label"?: string
}

/** The Markdown writer escapes "[" as "\\[", which would break [[Note title]] links. */
function unescapeWikiLinks(markdown: string) {
  return markdown.replace(/\\\[\\\[(.+?)\\\]\\\]/g, (_, inner: string) => `[[${inner.replace(/\\([[\]|])/g, "$1")}]]`)
}

/**
 * A Notion-style editor that reads and writes Markdown.
 * "/" opens the block menu; Markdown shortcuts (#, -, 1., >, ```, **bold**) work as you type.
 */
export function RichEditor({ value, onChange, placeholder, compact = false, bare = false, className, ...rest }: Props) {
  // The editor is created once, so it calls the latest onChange through a ref.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const editorRef = useRef<Editor | null>(null)
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      Markdown,
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: placeholder ?? "Type / for blocks, or just start writing…" }),
      SlashCommand,
    ],
    content: value,
    contentType: "markdown",
    onCreate: ({ editor }) => {
      editorRef.current = editor
    },
    onUpdate: ({ editor }) => onChangeRef.current(unescapeWikiLinks(editor.getMarkdown())),
    editorProps: {
      // Pasting Markdown as plain text (e.g. from a terminal) turns into real headings, lists and tables.
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData("text/html")
        const text = event.clipboardData?.getData("text/plain")
        if (html || !text || !LOOKS_LIKE_MARKDOWN.test(text) || !editorRef.current) return false
        if (editorRef.current.isActive("codeBlock")) return false
        editorRef.current.commands.insertContent(text, { contentType: "markdown" })
        return true
      },
      attributes: {
        class: cn("tiptap prose-note", compact ? "min-h-16!" : "min-h-40"),
        "aria-label": rest["aria-label"] ?? "Editor",
        "aria-multiline": "true",
        role: "textbox",
      },
    },
  })

  return (
    <div
      className={cn(
        !bare && "rounded-2xl border bg-card px-4 py-3 transition-colors focus-within:border-foreground/40 sm:px-5 sm:py-4",
        className,
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) editor?.commands.focus("end")
      }}
    >
      {editor ? <EditorContent editor={editor} /> : <div className={compact ? "min-h-16" : "min-h-40"} />}
    </div>
  )
}
