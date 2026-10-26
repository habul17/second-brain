"use client"

import { Fragment, useState, type ReactNode } from "react"
import Link from "next/link"
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { motion } from "motion/react"
import { highlight } from "sugar-high"
import { cn } from "cn"
import type { Link as MdLink, Parent, PhrasingContent, Root } from "mdast"
import { Mermaid } from "@/components/mermaid"

const WIKI_LINK = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g
const MISSING = "#missing-note"

/**
 * Remark plugin: turns [[Title]] / [[Title|label]] in text into links.
 * Works on text nodes only, so C++ attributes like [[nodiscard]] inside code stay untouched.
 */
function wikiLinks(linkMap: Record<string, string>) {
  return () => (tree: Root) => {
    const walk = (node: Parent) => {
      if (node.type === "link") return
      node.children = node.children.flatMap((child) => {
        if ("children" in child) walk(child as Parent)
        if (child.type !== "text" || !child.value.includes("[[")) return [child]
        const out: PhrasingContent[] = []
        let last = 0
        for (const m of child.value.matchAll(WIKI_LINK)) {
          if (m.index > last) out.push({ type: "text", value: child.value.slice(last, m.index) })
          const id = linkMap[m[1].trim().toLowerCase()]
          const link: MdLink = {
            type: "link",
            url: id ? `/n/${id}` : MISSING,
            title: id ? null : `No note called "${m[1].trim()}" yet`,
            children: [{ type: "text", value: (m[2] ?? m[1]).trim() }],
          }
          out.push(link)
          last = m.index + m[0].length
        }
        if (last < child.value.length) out.push({ type: "text", value: child.value.slice(last) })
        return out
      }) as Parent["children"]
    }
    walk(tree)
  }
}

/** A hidden key word: a dashed blank you tap to reveal. */
function Blank({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setShown(true)}
      aria-label={shown ? undefined : "Hidden key word. Tap to reveal."}
      className={cn(
        "mx-0.5 inline rounded-md px-1.5 font-semibold transition-colors",
        shown ? "marker" : "border border-dashed border-foreground/50 bg-muted text-transparent hover:bg-foreground/10",
      )}
    >
      {children}
    </button>
  )
}

interface Props {
  children: string
  /** title (lowercase) → note id, for [[links]]. */
  linkMap?: Record<string, string>
  /** "marker" draws a highlighter over **bold** words (the Say it step). */
  mode?: "bold" | "marker"
  /** Practice: **bold** words become blanks. */
  hideKeywords?: boolean
  /** One line of text: no paragraph spacing. */
  inline?: boolean
  className?: string
}

export function Markdown({ children, linkMap = {}, mode = "bold", hideKeywords = false, inline = false, className }: Props) {
  let order = 0
  const components: Components = {
    a({ href = "", children, title }) {
      if (href === MISSING) {
        return (
          <span title={title ?? undefined} className="cursor-help border-b border-dashed border-muted-foreground text-muted-foreground">
            {children}
          </span>
        )
      }
      if (href.startsWith("/")) return <Link href={href}>{children}</Link>
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      )
    },
    strong({ children }) {
      if (hideKeywords) return <Blank>{children}</Blank>
      if (mode === "marker") {
        const delay = 0.15 + order++ * 0.15
        return (
          <motion.strong
            className="marker"
            initial={{ backgroundSize: "0% 100%" }}
            animate={{ backgroundSize: "100% 100%" }}
            transition={{ duration: 0.45, delay, ease: "easeOut" }}
          >
            {children}
          </motion.strong>
        )
      }
      return <strong>{children}</strong>
    },
    pre({ children }) {
      return <>{children}</>
    },
    code({ className: lang, children }) {
      const text = String(children ?? "")
      const language = /language-(\w+)/.exec(lang ?? "")?.[1]
      if (language === "mermaid") return <Mermaid code={text.trim()} />
      // Fenced block (has a language or spans lines) vs `inline code`.
      if (language || text.includes("\n")) {
        return (
          <pre className="code-block">
            <code dangerouslySetInnerHTML={{ __html: highlight(text.replace(/\n$/, "")) }} />
          </pre>
        )
      }
      return <code>{children}</code>
    },
    ...(inline ? { p: ({ children }) => <Fragment>{children}</Fragment> } : {}),
  }

  const body = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, wikiLinks(linkMap)]}
      components={components}
      urlTransform={(url) => (url === MISSING ? url : defaultUrlTransform(url))}
    >
      {children}
    </ReactMarkdown>
  )
  // Inline text sits inside other elements (list items, buttons), so no wrapping <div>.
  return inline ? body : <div className={cn("prose-note", className)}>{body}</div>
}

/** Plain words for reading aloud: no markdown symbols, no code blocks. */
export function speakable(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(WIKI_LINK, (_, title: string, label?: string) => label ?? title)
    .replace(/[*_`#>|]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

/** The **bold** words of a markdown text. */
export function keywordsOf(markdown: string) {
  return [...markdown.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1])
}
