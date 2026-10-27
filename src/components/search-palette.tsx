"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"
import { searchAction } from "@/actions/search"
import { embedQuery, onEmbedderStatus, warmUp, type EmbedderStatus } from "@/lib/embedder"
import type { SearchHit } from "@/server/search"
import { Command, CommandDialog, CommandList } from "@/components/ui/command"

const OPEN_EVENT = "sb:open-search"

export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

const SHORTCUTS = [
  { label: "Home", href: "/" },
  { label: "Start today's review", href: "/review" },
  { label: "New note", href: "/new" },
  { label: "Mock interview", href: "/?open=mock" },
  { label: "Weak spots", href: "/?open=weak" },
  { label: "Settings", href: "/settings" },
]

const item =
  "flex cursor-default items-center gap-3 rounded-[10px] px-3 py-2.5 text-base outline-none select-none data-selected:bg-accent sm:px-3.5"
const heading = "block px-3 pt-3 pb-1 text-xs font-bold tracking-wider text-muted-foreground uppercase sm:px-3.5"

/** The title with every typed word in bold. */
function Marked({ text, query }: { text: string; query: string }) {
  const words = query.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  if (!words.length) return text
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"))
  return parts.map((p, i) => (i % 2 ? <b key={i} className="font-extrabold">{p}</b> : <Fragment key={i}>{p}</Fragment>))
}

export function SearchPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [model, setModel] = useState<EmbedderStatus>("idle")
  const latest = useRef(0)

  useEffect(() => onEmbedderStatus(setModel), [])

  useEffect(() => {
    const show = () => setOpen(true)
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
      const tag = (e.target as HTMLElement | null)?.tagName
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable
      if (e.key === "/" && !typing) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener(OPEN_EVENT, show)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener(OPEN_EVENT, show)
      window.removeEventListener("keydown", onKey)
    }
  }, [])

  // Opening search is the moment to load the meaning model (in a worker, never blocking).
  useEffect(() => {
    if (open) void warmUp()
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (!q) return
    const ticket = ++latest.current
    const timer = setTimeout(async () => {
      const embedding = await embedQuery(q)
      const result = await searchAction(q, embedding)
      if (ticket === latest.current) {
        setHits(result)
        setSearching(false)
      }
    }, 140)
    return () => clearTimeout(timer)
  }, [query, model])

  // While typing, shortcuts whose name matches stay one Enter away ("mock", "new", "settings").
  const q = query.trim().toLowerCase()
  const actions = q ? SHORTCUTS.filter((s) => s.label.toLowerCase().split(/\s+/).some((w) => w.startsWith(q))) : SHORTCUTS
  const notes = q ? hits : []

  function go(href: string) {
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search everything you learned"
      className="top-2.5 max-w-[calc(100%-1rem)] rounded-2xl! sm:top-16 sm:max-w-[580px]"
    >
      <Command shouldFilter={false} className="rounded-2xl! p-0">
        <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-5 sm:py-3.5">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <CommandPrimitive.Input
            autoFocus
            placeholder="Search your notes"
            value={query}
            onValueChange={(v) => {
              setQuery(v)
              setSearching(true)
            }}
            className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded-[5px] border px-1.5 font-mono text-[0.7rem] text-muted-foreground sm:block">Esc</kbd>
        </div>
        <CommandList className="max-h-[min(60svh,26rem)] px-1 pt-1.5 pb-2 sm:px-1.5">
          {notes.map((hit) => (
            <CommandPrimitive.Item key={hit.id} value={hit.id} onSelect={() => go(`/n/${hit.id}`)} className={item}>
              <span className="grid min-w-0 flex-1 gap-0.5 sm:flex sm:items-center sm:gap-3">
                <span className="min-w-0 truncate sm:flex-1">
                  <Marked text={hit.title} query={q} />
                </span>
                <span className="truncate text-sm text-muted-foreground sm:max-w-[45%] sm:shrink-0">
                  {hit.sectionName} › {hit.topicName}
                </span>
              </span>
            </CommandPrimitive.Item>
          ))}
          {q && !searching && !notes.length && (
            <p className="px-4 py-6 text-center text-muted-foreground">Nothing found. Try other words, or describe the idea.</p>
          )}
          {actions.length > 0 && (
            <CommandPrimitive.Group heading={<span className={heading}>Go to</span>}>
              {actions.map((s) => (
                <CommandPrimitive.Item key={s.href} value={s.href} onSelect={() => go(s.href)} className={item}>
                  {s.label}
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
