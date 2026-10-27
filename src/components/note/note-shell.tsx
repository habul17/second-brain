"use client"

import { createContext, useContext, useState, useSyncExternalStore } from "react"
import { ChevronsUpDown, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react"
import { cn } from "cn"
import { TopicTree } from "@/components/tree/topic-tree"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { SectionIcon } from "@/lib/icons"
import type { TreeTopic } from "@/server/topics"

// Whether the laptop sidebar is hidden, kept in this browser.
const KEY = "sb:sidebar"
const listeners = new Set<() => void>()

function readHidden() {
  try {
    return localStorage.getItem(KEY) === "hidden"
  } catch {
    return false
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  window.addEventListener("storage", fn)
  return () => {
    listeners.delete(fn)
    window.removeEventListener("storage", fn)
  }
}

function setHidden(hidden: boolean) {
  try {
    localStorage.setItem(KEY, hidden ? "hidden" : "shown")
  } catch {}
  listeners.forEach((fn) => fn())
}

const Shell = createContext({ hidden: false, openDrawer: () => {} })

interface Props {
  sections: { id: string; name: string }[]
  /** Every section's topics, so the switcher can change section without leaving the note. */
  topics: TreeTopic[]
  sectionId: string
  noteId: string
  children: React.ReactNode
}

/** The note page: a sidebar with every topic and note on a laptop (can be hidden), a ☰ drawer on a phone. */
export function NoteShell({ sections, topics, sectionId, noteId, children }: Props) {
  const hidden = useSyncExternalStore(subscribe, readHidden, () => false)
  const [drawer, setDrawer] = useState(false)
  const body = (inDrawer: boolean) => (
    <SidebarBody sections={sections} topics={topics} sectionId={sectionId} noteId={noteId} inDrawer={inDrawer} onClose={() => setDrawer(false)} />
  )

  return (
    <Shell.Provider value={{ hidden, openDrawer: () => setDrawer(true) }}>
      {/* data-full: the app layout lets this page use the whole width. */}
      <div data-full className={cn("grid min-h-[calc(100svh-3.75rem)]", !hidden && "lg:grid-cols-[280px_minmax(0,1fr)]")}>
        {!hidden && (
          <nav aria-label="Notes" className="sticky top-15 hidden h-[calc(100svh-3.75rem)] overflow-y-auto border-r px-2.5 py-3.5 lg:block">
            {body(false)}
          </nav>
        )}
        <div className="min-w-0">{children}</div>
      </div>
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" showCloseButton={false} className="w-[86%] gap-3 overflow-y-auto px-2.5 py-3.5 lg:hidden">
          <SheetTitle className="sr-only">Notes</SheetTitle>
          {body(true)}
        </SheetContent>
      </Sheet>
    </Shell.Provider>
  )
}

/** ☰ on a phone (opens the drawer); on a laptop it only shows while the sidebar is hidden, to bring it back. */
export function SidebarToggle() {
  const { hidden, openDrawer } = useContext(Shell)
  return (
    <>
      <Button variant="outline" size="icon" aria-label="Open sidebar" className="lg:hidden" onClick={openDrawer}>
        <Menu />
      </Button>
      {hidden && (
        <Button variant="outline" size="icon" aria-label="Show sidebar" className="max-lg:hidden" onClick={() => setHidden(false)}>
          <PanelLeftOpen />
        </Button>
      )}
    </>
  )
}

function SidebarBody({
  sections,
  topics,
  sectionId,
  noteId,
  inDrawer,
  onClose,
}: Omit<Props, "children"> & { inDrawer: boolean; onClose: () => void }) {
  const [shown, setShown] = useState(sectionId)
  const section = sections.find((s) => s.id === shown) ?? sections[0]
  const inSection = topics.filter((t) => t.sectionId === shown)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-3">
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-[38px] min-w-0 flex-1 items-center gap-[9px] rounded-[10px] border pr-2.5 pl-[7px] text-left font-bold transition-colors hover:bg-accent"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-foreground text-background">
                <SectionIcon name={section?.name ?? ""} className="size-[13px]" />
              </span>
              <span className="min-w-0 flex-1 truncate">{section?.name}</span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
            {sections.map((s) => (
              <DropdownMenuItem key={s.id} onSelect={() => setShown(s.id)} className={cn(s.id === shown && "font-bold")}>
                <SectionIcon name={s.name} /> {s.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {inDrawer ? (
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Hide sidebar" onClick={() => setHidden(true)}>
            <PanelLeftClose />
          </Button>
        )}
      </div>
      {inSection.length ? (
        <TopicTree sectionId={shown} topics={inSection} activeNoteId={noteId} compact onNavigate={onClose} />
      ) : (
        <p className="px-2 text-sm text-muted-foreground">No topics here yet.</p>
      )}
    </div>
  )
}
