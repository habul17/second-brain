import Link from "next/link"
import { Code2, Dumbbell, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NoteKind } from "@/db/schema"

/** Edit, and Solve (problems) or Practice. Move and Delete live in the editor. */
export function NoteMenu({ note }: { note: { id: string; kind: NoteKind } }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button asChild variant="outline" size="icon" aria-label="Edit">
        <Link href={`/n/${note.id}/edit`}>
          <Pencil />
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
    </div>
  )
}
