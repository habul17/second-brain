import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, CalendarClock, ChevronRight, Code2, Link2, Puzzle } from "lucide-react"
import { z } from "zod"
import { NoteMenu } from "@/components/note/note-menu"
import { NoteView } from "@/components/note/note-view"
import { KIND_ICON, KIND_LABEL } from "@/lib/icons"
import { getNote } from "@/server/notes"
import { requireUser } from "@/server/session"
import { listAllTopics } from "@/server/topics"

async function load(noteId: string) {
  if (!z.uuid().safeParse(noteId).success) notFound()
  const user = await requireUser()
  const full = await getNote(user.id, noteId)
  if (!full) notFound()
  return { user, full }
}

export async function generateMetadata({ params }: PageProps<"/n/[noteId]">) {
  const { full } = await load((await params).noteId)
  return { title: full.note.title }
}

function relativeDue(due: Date | undefined) {
  if (!due) return "not scheduled"
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return "due now"
  if (days === 1) return "tomorrow"
  if (days < 30) return `in ${days} days`
  const months = Math.round(days / 30)
  return `in ${months} month${months === 1 ? "" : "s"}`
}

export default async function NotePage({ params }: PageProps<"/n/[noteId]">) {
  const { user, full } = await load((await params).noteId)
  const topics = await listAllTopics(user.id)
  const { note, section, topic, patterns, problems, backlinks } = full
  const nextReview = relativeDue(full.card?.due)
  const KindIcon = KIND_ICON[note.kind]

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-10">
      <header className="grid gap-4">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <Link href={`/s/${section.id}`} className="truncate hover:text-foreground">
            {section.name}
          </Link>
          <ChevronRight className="size-3.5 shrink-0" />
          <Link href={`/s/${section.id}#t-${topic.id}`} className="truncate hover:text-foreground">
            {topic.name}
          </Link>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="min-w-0 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{note.title}</h1>
          <NoteMenu note={note} sectionId={section.id} topics={topics} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {note.kind !== "concept" && (
            <span className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium text-foreground">
              <KindIcon className="size-3.5" /> {KIND_LABEL[note.kind]}
            </span>
          )}
          {note.difficulty && <span className="rounded-md border px-2 py-1 capitalize">{note.difficulty}</span>}
          {patterns.map((p) => (
            <Link key={p.id} href={`/n/${p.id}`} className="flex items-center gap-1.5 rounded-md border px-2 py-1 hover:text-foreground">
              <Puzzle className="size-3.5" /> {p.title}
            </Link>
          ))}
          <span className="flex items-center gap-1.5 px-1 py-1">
            <CalendarClock className="size-3.5" /> Next review {nextReview}
          </span>
        </div>
      </header>

      <NoteView full={full} nextReview={nextReview} />

      {(problems.length > 0 || backlinks.length > 0) && (
        <aside className="grid gap-8 rounded-3xl border bg-card p-5 sm:p-8">
          {problems.length > 0 && (
            <div className="grid gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Code2 className="size-4" /> Problems that use this pattern
              </h2>
              <ul className="grid gap-1">
                {problems.map((p) => (
                  <li key={p.id}>
                    <Link href={`/n/${p.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      {p.difficulty && <span className="text-xs text-muted-foreground capitalize">{p.difficulty}</span>}
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {backlinks.length > 0 && (
            <div className="grid gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Link2 className="size-4" /> Notes that link here
              </h2>
              <ul className="grid gap-1">
                {backlinks.map((b) => (
                  <li key={b.id}>
                    <Link href={`/n/${b.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                      <span className="min-w-0 flex-1 truncate">{b.title}</span>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
