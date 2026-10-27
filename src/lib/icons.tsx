import { createElement } from "react"
import {
  Anchor,
  Atom,
  Binary,
  BookOpen,
  Cloud,
  Code2,
  Compass,
  Cpu,
  Database,
  Feather,
  FileText,
  Gem,
  Globe,
  Languages,
  Leaf,
  Lightbulb,
  MessagesSquare,
  Mountain,
  Network,
  Palette,
  Puzzle,
  Rocket,
  Server,
  Shapes,
  Shield,
  Sigma,
  Smartphone,
  Sparkles,
  Telescope,
  type LucideIcon,
} from "lucide-react"
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

const ICONS = {
  globe: Globe,
  binary: Binary,
  sparkles: Sparkles,
  server: Server,
  database: Database,
  network: Network,
  cpu: Cpu,
  shield: Shield,
  sigma: Sigma,
  cloud: Cloud,
  smartphone: Smartphone,
  messages: MessagesSquare,
  languages: Languages,
  book: BookOpen,
  compass: Compass,
  lightbulb: Lightbulb,
  rocket: Rocket,
  shapes: Shapes,
  leaf: Leaf,
  atom: Atom,
  palette: Palette,
  mountain: Mountain,
  gem: Gem,
  telescope: Telescope,
  feather: Feather,
  anchor: Anchor,
} satisfies Record<string, LucideIcon>

export type SectionIconName = keyof typeof ICONS

// A fitting icon guessed from the section's name. First match wins.
const BY_NAME: [RegExp, SectionIconName][] = [
  [/\b(dev|web|frontend|front-end|react|next)\b/i, "globe"],
  [/\b(dsa|algo|algorithms?|leetcode|data structures?)\b/i, "binary"],
  [/\b(ai|ml|llm|machine learning)\b/i, "sparkles"],
  [/\b(backend|back-end|server|api)\b/i, "server"],
  [/\b(db|database|sql)\b/i, "database"],
  [/\b(system design|architecture|distributed|networking?)\b/i, "network"],
  [/\b(system|os|hardware|low.level)\b/i, "cpu"],
  [/\b(security|auth|crypto)\b/i, "shield"],
  [/\b(math|maths|stats|statistics|probability)\b/i, "sigma"],
  [/\b(cloud|devops|aws|docker|kubernetes)\b/i, "cloud"],
  [/\b(mobile|ios|android)\b/i, "smartphone"],
  [/\b(behaviou?ral|interviews?|soft skills)\b/i, "messages"],
  [/\b(english|language|languages|grammar)\b/i, "languages"],
  [/\b(books?|reading)\b/i, "book"],
]

// For names that give no hint. Each new section takes the next one no other section uses.
const SPARE: SectionIconName[] = [
  "compass",
  "lightbulb",
  "rocket",
  "shapes",
  "leaf",
  "atom",
  "palette",
  "mountain",
  "gem",
  "telescope",
  "feather",
  "anchor",
  "book",
]

/**
 * One icon per section id, each different from the others while icons last.
 * Older sections choose first, so adding a section never changes an existing icon.
 */
export function sectionIcons(sections: { id: string; name: string; createdAt: Date }[]): Record<string, SectionIconName> {
  const oldestFirst = [...sections].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const used = new Set<SectionIconName>()
  const icons: Record<string, SectionIconName> = {}
  for (const s of oldestFirst) {
    const guess = BY_NAME.find(([re]) => re.test(s.name))?.[1]
    const icon = guess && !used.has(guess) ? guess : (SPARE.find((i) => !used.has(i)) ?? SPARE[used.size % SPARE.length])
    used.add(icon)
    icons[s.id] = icon
  }
  return icons
}

export function SectionIcon({ icon, className }: { icon: SectionIconName | undefined; className?: string }) {
  return createElement(ICONS[icon ?? "book"], { className })
}
