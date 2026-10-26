"use client"

import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { Extension, ReactRenderer, type Editor, type Range } from "@tiptap/react"
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion"
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

interface Item {
  title: string
  hint: string
  icon: LucideIcon
  keywords: string
  run: (editor: Editor, range: Range) => void
}

const ITEMS: Item[] = [
  { title: "Text", hint: "Plain paragraph", icon: Pilcrow, keywords: "paragraph p", run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { title: "Heading 1", hint: "#", icon: Heading1, keywords: "h1 title big", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { title: "Heading 2", hint: "##", icon: Heading2, keywords: "h2 subtitle", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { title: "Heading 3", hint: "###", icon: Heading3, keywords: "h3", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { title: "Bullet list", hint: "-", icon: List, keywords: "ul unordered points", run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: "Numbered list", hint: "1.", icon: ListOrdered, keywords: "ol ordered steps", run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: "Quote", hint: ">", icon: Quote, keywords: "blockquote callout", run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: "Code block", hint: "```", icon: Code2, keywords: "code snippet pre", run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  {
    title: "Diagram",
    hint: "Mermaid",
    icon: Workflow,
    keywords: "mermaid flow chart diagram graph sequence",
    run: (e, r) =>
      e
        .chain()
        .focus()
        .deleteRange(r)
        .insertContent({ type: "codeBlock", attrs: { language: "mermaid" }, content: [{ type: "text", text: "flowchart LR\n  A[Request] --> B[Server]\n  B --> C[(Database)]" }] })
        .run(),
  },
  {
    title: "Table",
    hint: "3 × 3",
    icon: Table,
    keywords: "table grid compare",
    run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  { title: "Divider", hint: "---", icon: Minus, keywords: "hr line separator", run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
]

interface MenuHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

const Menu = forwardRef<MenuHandle, SuggestionProps<Item, Item>>(function Menu({ items, command }, ref) {
  const [active, setActive] = useState(0)
  useEffect(() => setActive(0), [items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false
      if (event.key === "ArrowDown") setActive((a) => (a + 1) % items.length)
      else if (event.key === "ArrowUp") setActive((a) => (a - 1 + items.length) % items.length)
      else if (event.key === "Enter") command(items[active])
      else return false
      return true
    },
  }))

  if (!items.length) {
    return <div className="w-64 rounded-xl border bg-popover p-3 text-sm text-muted-foreground shadow-lg">No match</div>
  }

  return (
    <div role="listbox" className="z-50 grid max-h-80 w-64 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
      {items.map((item, i) => (
        <button
          key={item.title}
          type="button"
          role="option"
          aria-selected={i === active}
          onMouseEnter={() => setActive(i)}
          onMouseDown={(e) => {
            e.preventDefault()
            command(item)
          }}
          className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm", i === active && "bg-accent")}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background">
            <item.icon className="size-4" />
          </span>
          <span className="flex-1">{item.title}</span>
          <span className="font-mono text-xs text-muted-foreground">{item.hint}</span>
        </button>
      ))}
    </div>
  )
})

/** Type "/" at the start of a line (or after a space) for a menu of blocks, like Notion. */
export const SlashCommand = Extension.create({
  name: "slashCommand",
  addProseMirrorPlugins() {
    return [
      Suggestion<Item, Item>({
        editor: this.editor,
        char: "/",
        allowedPrefixes: [" "],
        items: ({ query }) => {
          const q = query.toLowerCase()
          return ITEMS.filter((i) => `${i.title} ${i.keywords}`.toLowerCase().includes(q))
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        allow: ({ editor }) => !editor.isActive("codeBlock"),
        render: () => {
          let renderer: ReactRenderer<MenuHandle, SuggestionProps<Item, Item>> | null = null
          let unmount: (() => void) | null = null
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(Menu, { props, editor: props.editor })
              unmount = props.mount(renderer.element as HTMLElement)
            },
            onUpdate: (props) => renderer?.updateProps(props),
            onKeyDown: (props) => {
              if (props.event.key === "Escape") return false
              return renderer?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              unmount?.()
              renderer?.destroy()
              renderer = null
            },
          }
        },
      }),
    ]
  },
})
