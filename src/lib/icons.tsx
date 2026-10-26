import { createElement } from "react"
import { Binary, BookOpen, Code2, Cpu, Database, FileText, Globe, Puzzle, Server, Sparkles, type LucideIcon } from "lucide-react"
import type { NoteKind } from "@/db/schema"

export const KIND_ICON: Record<NoteKind, LucideIcon> = {
  concept: FileText,
  pattern: Puzzle,
  problem: Code2,
}

export const KIND_LABEL: Record<NoteKind, string> = {
  concept: "Concept",
  pattern: "Pattern",
  problem: "Problem",
}

const SECTION_ICONS: [RegExp, LucideIcon][] = [
  [/\b(web|frontend|front-end|react|next)\b/i, Globe],
  [/\b(dsa|algo|algorithms?|leetcode|data structures?)\b/i, Binary],
  [/\b(ai|ml|llm|machine learning)\b/i, Sparkles],
  [/\b(backend|back-end|server|api)\b/i, Server],
  [/\b(db|database|sql)\b/i, Database],
  [/\b(system|os|hardware|low.level)\b/i, Cpu],
]

/** A fitting icon for a section, guessed from its name. */
export function sectionIcon(name: string): LucideIcon {
  return SECTION_ICONS.find(([re]) => re.test(name))?.[1] ?? BookOpen
}

export function SectionIcon({ name, className }: { name: string; className?: string }) {
  return createElement(sectionIcon(name), { className })
}
