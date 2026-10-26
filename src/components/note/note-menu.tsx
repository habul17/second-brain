"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Code2, Dumbbell, FolderInput, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deleteNoteAction, moveNoteAction } from "@/actions/library"
import { ConfirmDelete } from "@/components/section-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { NoteKind } from "@/db/schema"
import type { TopicOption } from "@/server/topics"

interface Props {
  note: { id: string; title: string; topicId: string; kind: NoteKind }
  sectionId: string
  topics: TopicOption[]
}

export function NoteMenu({ note, sectionId, topics }: Props) {
  const router = useRouter()
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [target, setTarget] = useState(note.topicId)
  const [pending, setPending] = useState(false)

  const groups = Object.values(
    topics.reduce<Record<string, { name: string; topics: TopicOption[] }>>((acc, t) => {
      ;(acc[t.sectionId] ??= { name: t.sectionName, topics: [] }).topics.push(t)
      return acc
    }, {}),
  )

  async function move() {
    setPending(true)
    try {
      await moveNoteAction(note.id, target)
      const to = topics.find((t) => t.id === target)
      toast(`Moved to ${to?.sectionName} › ${to?.name}`)
      setMoving(false)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button asChild variant="outline" aria-label="Edit">
        <Link href={`/n/${note.id}/edit`}>
          <Pencil /> <span className="hidden sm:inline">Edit</span>
        </Link>
      </Button>
      {/* Problems: solving is the main thing to do here. Other notes: a quick practice round. */}
      {note.kind === "problem" ? (
        <Button asChild>
          <Link href={`/practice?notes=${note.id}`}>
            <Code2 /> Solve
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline" aria-label="Practice">
          <Link href={`/practice?notes=${note.id}`}>
            <Dumbbell /> <span className="hidden sm:inline">Practice</span>
          </Link>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Note options">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={() => {
              setTarget(note.topicId)
              setMoving(true)
            }}
          >
            <FolderInput /> Move to…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete note
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={moving} onOpenChange={setMoving}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move note</DialogTitle>
            <DialogDescription>Pick the topic it belongs in. Its review schedule stays the same.</DialogDescription>
          </DialogHeader>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectGroup key={g.name}>
                  <SelectLabel>{g.name}</SelectLabel>
                  {g.topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoving(false)}>
              Cancel
            </Button>
            <Button onClick={move} disabled={pending || target === note.topicId}>
              {pending && <Loader2 className="animate-spin" />} Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete "${note.title}"?`}
        description="The note and its review history are gone for good. Links to it from other notes will show as missing."
        onConfirm={() => deleteNoteAction(note.id, sectionId)}
      />
    </div>
  )
}
