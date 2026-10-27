"use client"

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, Flame, Folder, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { cn } from "cn"
import { createTopicAction, deleteTopicAction, renameTopicAction } from "@/actions/library"
import { NameDialog } from "@/components/name-dialog"
import { ConfirmDelete } from "@/components/section-actions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { KIND_ICON } from "@/lib/icons"
import type { TreeTopic } from "@/server/topics"

// Which folders are open, kept in this browser so the tree looks the same next visit.
const KEY = "sb:open-topics"
const listeners = new Set<() => void>()

function readOpen() {
  try {
    return localStorage.getItem(KEY) ?? ""
  } catch {
    return ""
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

function setOpen(id: string, open: boolean) {
  const ids = new Set(readOpen().split(",").filter(Boolean))
  if (open) ids.add(id)
  else ids.delete(id)
  try {
    localStorage.setItem(KEY, [...ids].join(","))
  } catch {}
  listeners.forEach((fn) => fn())
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

interface Props {
  sectionId: string
  topics: TreeTopic[]
  /** The note being read: highlighted, and its folders open. */
  activeNoteId?: string
  /** Smaller rows for the note page's sidebar. */
  compact?: boolean
  /** Folder menus (new note, new subtopic, rename, delete). */
  editable?: boolean
  onNavigate?: () => void
}

/** Section › Topic › Subtopic › Note as one folder tree. */
export function TopicTree({ sectionId, topics, activeNoteId, compact, editable, onNavigate }: Props) {
  const stored = useSyncExternalStore(subscribe, readOpen, () => "")
  const open = new Set(stored.split(",").filter(Boolean))
  const activeTopic = topics.find((t) => t.notes.some((n) => n.id === activeNoteId))
  if (activeTopic) {
    open.add(activeTopic.id)
    if (activeTopic.parentId) open.add(activeTopic.parentId)
  }

  const childrenOf = (id: string | null) => topics.filter((t) => t.parentId === id)
  const notesIn = (t: TreeTopic) => [t, ...childrenOf(t.id)].flatMap((x) => x.notes)
  const indent = (depth: number) => ({ paddingLeft: compact ? 8 + depth * 16 : 10 + depth * 22 })
  const row = cn("flex items-center rounded-[9px] pr-2.5 transition-colors hover:bg-accent", compact ? "min-h-9 gap-2 text-[0.93rem]" : "min-h-[42px] gap-[9px]")

  function folder(t: TreeTopic, depth: number): React.ReactNode {
    const isOpen = open.has(t.id)
    const all = notesIn(t)
    const due = all.filter((n) => n.due).length
    const subtopics = childrenOf(t.id)
    return (
      <div key={t.id} role="treeitem" aria-expanded={isOpen} aria-selected={false} className="grid grid-cols-[minmax(0,1fr)] gap-px">
        <div className={cn(row, "group font-bold")} style={indent(depth)}>
          <button type="button" onClick={() => setOpen(t.id, !isOpen)} className="flex min-w-0 flex-1 items-center gap-[inherit] self-stretch text-left">
            {isOpen ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
            {!compact && <Folder className="size-4 shrink-0" />}
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            {!compact && (
              <span className="text-[0.84rem] font-normal whitespace-nowrap text-muted-foreground tabular-nums">
                {plural(all.length, "note")}
                {due > 0 && ` · ${due} due`}
              </span>
            )}
          </button>
          {editable && <FolderMenu sectionId={sectionId} topic={t} depth={depth} noteCount={all.length} hasSubtopics={subtopics.length > 0} />}
        </div>
        {isOpen && (
          <div role="group" className="grid grid-cols-[minmax(0,1fr)] gap-px">
            {subtopics.map((c) => folder(c, depth + 1))}
            {t.notes.map((n) => {
              const Icon = KIND_ICON[n.kind]
              const active = n.id === activeNoteId
              return (
                <Link
                  key={n.id}
                  href={`/n/${n.id}`}
                  role="treeitem"
                  aria-selected={active}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={cn(row, active && "bg-accent font-bold shadow-[inset_3px_0_0_var(--foreground)]")}
                  style={indent(depth + 1)}
                >
                  <span className="w-4 shrink-0" />
                  <Icon className={cn("size-4 shrink-0", !active && "text-muted-foreground")} />
                  <span className="min-w-0 flex-1 truncate">{n.title}</span>
                  {n.weak && (
                    <span className="flex shrink-0 items-center gap-1 rounded-md border px-1.5 text-[0.72rem] font-semibold text-muted-foreground">
                      <Flame className="size-[11px]" /> weak
                    </span>
                  )}
                  {n.due && <span className="shrink-0 rounded-md bg-foreground px-1.5 text-[0.72rem] font-bold text-background">due</span>}
                </Link>
              )
            })}
            {!subtopics.length && !t.notes.length && (
              <Link href={`/new?topic=${t.id}`} className={cn(row, "text-muted-foreground")} style={indent(depth + 1)}>
                <span className="w-4 shrink-0" />
                <Plus className="size-4 shrink-0" /> New note
              </Link>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div role="tree" className="grid grid-cols-[minmax(0,1fr)] gap-px">
      {childrenOf(null).map((t) => folder(t, 0))}
    </div>
  )
}

function FolderMenu({
  sectionId,
  topic,
  depth,
  noteCount,
  hasSubtopics,
}: {
  sectionId: string
  topic: TreeTopic
  depth: number
  noteCount: number
  hasSubtopics: boolean
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${topic.name} options`}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/new?topic=${topic.id}`}>
              <Plus /> New note
            </Link>
          </DropdownMenuItem>
          {depth === 0 && (
            <DropdownMenuItem onSelect={() => setAdding(true)}>
              <Folder /> New subtopic
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NameDialog
        open={adding}
        onOpenChange={setAdding}
        title={`New subtopic in ${topic.name}`}
        placeholder="Hooks"
        submitLabel="Create"
        onSubmit={async (name) => {
          await createTopicAction(sectionId, name, topic.id)
          setOpen(topic.id, true)
          router.refresh()
        }}
      />
      <NameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename"
        initial={topic.name}
        submitLabel="Save"
        onSubmit={async (name) => {
          await renameTopicAction(topic.id, name)
          router.refresh()
        }}
      />
      <ConfirmDelete
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete "${topic.name}"?`}
        description={
          noteCount > 0
            ? `This deletes ${plural(noteCount, "note")} inside it${hasSubtopics ? " and its subtopics" : ""}, with their review history. You can't undo this.`
            : "It's empty. You can't undo this."
        }
        onConfirm={async () => {
          await deleteTopicAction(topic.id)
          router.refresh()
        }}
      />
    </>
  )
}
