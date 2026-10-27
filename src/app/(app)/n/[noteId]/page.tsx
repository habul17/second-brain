import { Fragment } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { z } from "zod"
import { NoteMenu } from "@/components/note/note-menu"
import { NoteShell, SidebarToggle } from "@/components/note/note-shell"
import { NoteView } from "@/components/note/note-view"
import { getNote } from "@/server/notes"
import { listSections } from "@/server/sections"
import { requireUser } from "@/server/session"
import { sectionTree } from "@/server/topics"

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

const label = "mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase"

export default async function NotePage({ params }: PageProps<"/n/[noteId]">) {
  const { user, full } = await load((await params).noteId)
  const [sections, tree] = await Promise.all([listSections(user.id), sectionTree(user.id)])
  const { note, section, topic, patterns, problems, backlinks } = full
  // Section › Topic › Subtopic. A phone drops the section: the ☰ drawer shows it.
  const crumbs = [
    { name: section.name, phone: false },
    ...(topic.parent ? [{ name: topic.parent.name, phone: true }] : []),
    { name: topic.name, phone: true },
  ]

  return (
    <NoteShell sections={sections.map((s) => ({ id: s.id, name: s.name }))} topics={tree} sectionId={section.id} noteId={note.id}>
      <div className="mx-auto grid w-full max-w-[760px] grid-cols-[minmax(0,1fr)] content-start gap-[18px] px-4 pt-5 sm:px-8 sm:pt-[22px]">
        <div className="flex items-center gap-2">
          <SidebarToggle />
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-[0.9rem] text-muted-foreground">
            {crumbs.map((c, i) => (
              <Fragment key={i}>
                {i > 0 && <ChevronRight className={c.phone && crumbs[i - 1].phone ? "size-3.5 shrink-0" : "size-3.5 shrink-0 max-sm:hidden"} />}
                <Link href={`/s/${section.id}`} className={c.phone ? "truncate hover:text-foreground" : "truncate hover:text-foreground max-sm:hidden"}>
                  {c.name}
                </Link>
              </Fragment>
            ))}
          </nav>
          <NoteMenu note={note} />
        </div>

        <h1 className="text-2xl leading-[1.15] font-bold tracking-tight text-balance sm:text-[2rem]">{note.title}</h1>
        {(note.difficulty || patterns.length > 0) && (
          <p className="-mt-2 flex flex-wrap gap-x-1.5 text-[0.92rem] text-muted-foreground">
            {note.difficulty && <span className="capitalize">{note.difficulty}</span>}
            {patterns.map((p, i) => (
              <Fragment key={p.id}>
                {(i > 0 || note.difficulty) && <span aria-hidden>·</span>}
                <Link href={`/n/${p.id}`} className="underline-offset-4 hover:text-foreground hover:underline">
                  {p.title}
                </Link>
              </Fragment>
            ))}
          </p>
        )}

        <NoteView full={full} nextReview={relativeDue(full.card?.due)} />

        {(problems.length > 0 || backlinks.length > 0) && (
          <aside className="grid gap-6 pb-10">
            {problems.length > 0 && (
              <div>
                <h2 className={label}>Problems that use this pattern</h2>
                <ul>
                  {problems.map((p) => (
                    <li key={p.id} className="border-b last:border-b-0">
                      <Link href={`/n/${p.id}`} className="flex items-center gap-3 py-2.5 hover:underline">
                        <span className="min-w-0 flex-1 truncate">{p.title}</span>
                        {p.difficulty && <span className="text-sm text-muted-foreground capitalize">{p.difficulty}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {backlinks.length > 0 && (
              <div>
                <h2 className={label}>Notes that link here</h2>
                <ul>
                  {backlinks.map((b) => (
                    <li key={b.id} className="border-b last:border-b-0">
                      <Link href={`/n/${b.id}`} className="block truncate py-2.5 hover:underline">
                        {b.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>
    </NoteShell>
  )
}
