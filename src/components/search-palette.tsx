"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Brain, FileText, Flame, Home, Layers, Settings, Sparkles, Swords } from "lucide-react"
import { searchAction } from "@/actions/search"
import { embedQuery, onEmbedderStatus, warmUp, type EmbedderStatus } from "@/lib/embedder"
import { KIND_ICON } from "@/lib/icons"
import type { NoteKind } from "@/db/schema"
import type { SearchHit } from "@/server/search"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

const OPEN_EVENT = "sb:open-search"

export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

const SHORTCUTS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Start today's review", href: "/review", icon: Layers },
  { label: "Mock interview", href: "/mock", icon: Swords },
  { label: "Weak spots", href: "/weak", icon: Flame },
  { label: "Settings", href: "/settings", icon: Settings },
]

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

  function go(href: string) {
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search everything you learned" className="sm:max-w-xl">
      <Command shouldFilter={false} className="rounded-xl!">
        <CommandInput placeholder="Search everything you learned…" value={query} onValueChange={(v) => {
            setQuery(v)
            setSearching(true)
          }} />
        <CommandList className="max-h-[min(60svh,26rem)]">
          {query.trim() ? (
            <>
              {!searching && <CommandEmpty>Nothing found. Try other words, or describe the idea.</CommandEmpty>}
              {hits.length > 0 && (
                <CommandGroup heading="Notes">
                  {hits.map((hit) => {
                    const Icon = KIND_ICON[hit.kind as NoteKind] ?? FileText
                    const onlyMeaning = hit.via.length === 1 && hit.via[0] === "meaning"
                    return (
                      <CommandItem key={hit.id} value={hit.id} onSelect={() => go(`/n/${hit.id}`)} className="py-2.5">
                        <Icon />
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate font-medium">{hit.title}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {hit.sectionName} › {hit.topicName}
                          </span>
                        </span>
                        {onlyMeaning && (
                          <span className="flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                            <Sparkles className="size-3" /> meaning
                          </span>
                        )}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}
            </>
          ) : (
            <CommandGroup heading="Go to">
              {SHORTCUTS.map((s) => (
                <CommandItem key={s.href} value={s.href} onSelect={() => go(s.href)}>
                  <s.icon /> {s.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        <div className="flex items-center gap-2 border-t px-3 py-2 text-[0.7rem] text-muted-foreground">
          <Brain className="size-3.5" />
          {model === "ready" && "Word + meaning search"}
          {model === "loading" && "Word search ready · loading meaning search…"}
          {(model === "idle" || model === "failed") && "Word search"}
        </div>
      </Command>
    </CommandDialog>
  )
}
