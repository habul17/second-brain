"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import {
  createTopicAction,
  deleteSectionAction,
  deleteTopicAction,
  renameSectionAction,
  renameTopicAction,
  reorderSectionsAction,
} from "@/actions/library"
import { NameDialog } from "@/components/name-dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** "Delete X?" with a clear warning. The action runs while the dialog shows a spinner. */
export function ConfirmDelete({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              try {
                await onConfirm()
                onOpenChange(false)
              } finally {
                setPending(false)
              }
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export function SectionMenu({
  section,
  order,
  topicCount,
  noteCount,
}: {
  section: { id: string; name: string }
  /** Every section id, top to bottom, for moving this one. */
  order: string[]
  topicCount: number
  noteCount: number
}) {
  const router = useRouter()
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const index = order.indexOf(section.id)

  async function move(by: -1 | 1) {
    const next = [...order]
    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    await reorderSectionsAction(next)
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-lg" aria-label="Section options">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil /> Rename section
          </DropdownMenuItem>
          {index > 0 && (
            <DropdownMenuItem onSelect={() => move(-1)}>
              <ArrowUp /> Move earlier
            </DropdownMenuItem>
          )}
          {index >= 0 && index < order.length - 1 && (
            <DropdownMenuItem onSelect={() => move(1)}>
              <ArrowDown /> Move later
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete section
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename section"
        initial={section.name}
        submitLabel="Save"
        onSubmit={async (name) => {
          await renameSectionAction(section.id, name)
          router.refresh()
        }}
      />
      <ConfirmDelete
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete "${section.name}"?`}
        description={
          noteCount > 0
            ? `This deletes ${plural(topicCount, "topic")} and ${plural(noteCount, "note")}, with all their review history. You can't undo this.`
            : "This section is empty. You can't undo this."
        }
        onConfirm={() => deleteSectionAction(section.id)}
      />
    </>
  )
}

export function NewTopicButton({ sectionId, size = "default" }: { sectionId: string; size?: "default" | "lg" }) {
  const router = useRouter()
  return (
    <NameDialog
      title="New topic"
      description="A topic groups related notes, like React hooks or Two pointers."
      placeholder="React hooks"
      submitLabel="Create topic"
      onSubmit={async (name) => {
        await createTopicAction(sectionId, name)
        router.refresh()
      }}
      trigger={
        <Button size={size} className={size === "lg" ? "h-11 px-5 text-base" : undefined}>
          <Plus /> New topic
        </Button>
      }
    />
  )
}

export function TopicMenu({ topic, noteCount }: { topic: { id: string; name: string }; noteCount: number }) {
  const router = useRouter()
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/new?topic=${topic.id}`}>
          <Plus /> Note
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`${topic.name} options`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil /> Rename topic
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete topic
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename topic"
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
            ? `This deletes ${plural(noteCount, "note")} inside it, with their review history. You can't undo this.`
            : "This topic is empty. You can't undo this."
        }
        onConfirm={async () => {
          await deleteTopicAction(topic.id)
          router.refresh()
        }}
      />
    </div>
  )
}
