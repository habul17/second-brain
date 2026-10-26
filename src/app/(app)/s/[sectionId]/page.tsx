import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Flame, FolderOpen } from "lucide-react"
import { z } from "zod"
import { NewTopicButton, SectionMenu, TopicMenu } from "@/components/section-actions"
import { KIND_ICON, SectionIcon } from "@/lib/icons"
import { getSection, listSections } from "@/server/sections"
import { requireUser } from "@/server/session"
import { listTopicsWithNotes } from "@/server/topics"

async function load(sectionId: string) {
  if (!z.uuid().safeParse(sectionId).success) notFound()
  const user = await requireUser()
  const section = await getSection(user.id, sectionId)
  if (!section) notFound()
  return { user, section }
}

export async function generateMetadata({ params }: PageProps<"/s/[sectionId]">) {
  const { section } = await load((await params).sectionId)
  return { title: section.name }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export default async function SectionPage({ params }: PageProps<"/s/[sectionId]">) {
  const { user, section } = await load((await params).sectionId)
  const [topics, all] = await Promise.all([listTopicsWithNotes(user.id, section.id), listSections(user.id)])
  const noteCount = topics.reduce((sum, t) => sum + t.notes.length, 0)
  const now = new Date()

  return (
    <div className="grid grid-cols-1 gap-10">
      <div className="grid gap-6">
        <Link href="/" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Home
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-foreground text-background">
              <SectionIcon name={section.name} className="size-6" />
            </span>
            <div className="grid min-w-0 gap-0.5">
              <h1 className="truncate text-3xl font-semibold tracking-tight">{section.name}</h1>
              <p className="text-sm text-muted-foreground tabular-nums">
                {plural(topics.length, "topic")} · {plural(noteCount, "note")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {topics.length > 0 && <NewTopicButton sectionId={section.id} />}
            <SectionMenu
              section={section}
              order={all.map((s) => s.id)}
              topicCount={topics.length}
              noteCount={noteCount}
            />
          </div>
        </div>
      </div>

      {topics.length === 0 ? (
        <div className="grid justify-items-center gap-5 rounded-3xl border border-dashed px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-muted">
            <FolderOpen className="size-6" />
          </span>
          <div className="grid max-w-sm gap-1.5">
            <p className="text-lg font-semibold">No topics yet</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Start with a topic, like React hooks or Two pointers. Then add notes inside it, by hand or from Claude.
            </p>
          </div>
          <NewTopicButton sectionId={section.id} size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {topics.map((topic) => (
            <section key={topic.id} id={`t-${topic.id}`} className="scroll-mt-24 overflow-hidden rounded-3xl border bg-card">
              <header className="flex items-center justify-between gap-3 border-b py-3 pr-3 pl-5 sm:pl-6">
                <h2 className="min-w-0 truncate font-semibold">
                  {topic.name}
                  <span className="ml-2 font-mono text-xs font-normal text-muted-foreground tabular-nums">{topic.notes.length}</span>
                </h2>
                <TopicMenu topic={topic} noteCount={topic.notes.length} />
              </header>
              {topic.notes.length === 0 ? (
                <p className="px-5 py-5 text-sm text-muted-foreground sm:px-6">
                  No notes here yet.{" "}
                  <Link href={`/new?topic=${topic.id}`} className="text-foreground underline underline-offset-4">
                    Write the first one
                  </Link>
                  .
                </p>
              ) : (
                <ul className="grid grid-cols-1 divide-y">
                  {topic.notes.map((note) => {
                    const KindIcon = KIND_ICON[note.kind]
                    return (
                      <li key={note.id}>
                        <Link
                          href={`/n/${note.id}`}
                          className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50 sm:px-6"
                        >
                          <KindIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{note.title}</span>
                          {note.weak && (
                            <span className="flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground">
                              <Flame className="size-3" /> weak
                            </span>
                          )}
                          {note.due && note.due <= now && (
                            <span className="shrink-0 rounded-md bg-foreground px-1.5 py-0.5 font-mono text-[0.7rem] text-background">due</span>
                          )}
                          {note.difficulty && (
                            <span className="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground capitalize">
                              {note.difficulty}
                            </span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
