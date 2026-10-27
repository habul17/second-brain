import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { z } from "zod"
import { NewTopicButton, SectionMenu } from "@/components/section-actions"
import { TopicTree } from "@/components/tree/topic-tree"
import { SectionIcon, sectionIcons } from "@/lib/icons"
import { getSection, listSections } from "@/server/sections"
import { requireUser } from "@/server/session"
import { sectionTree } from "@/server/topics"

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
  const [topics, all] = await Promise.all([sectionTree(user.id, section.id), listSections(user.id)])
  const notes = topics.flatMap((t) => t.notes)
  const due = notes.filter((n) => n.due).length

  return (
    <div className="mx-auto grid w-full max-w-[760px] grid-cols-[minmax(0,1fr)] gap-6">
      <Link href="/" className="-mb-1 flex w-fit items-center gap-1 text-[0.9rem] text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Home
      </Link>
      <div className="flex items-center gap-3.5">
        <span className="grid size-[46px] shrink-0 place-items-center rounded-[13px] bg-foreground text-background">
          <SectionIcon icon={sectionIcons(all)[section.id]} className="size-5" />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h1 className="truncate text-[1.75rem] leading-tight font-bold tracking-tight">{section.name}</h1>
          <p className="text-[0.9rem] text-muted-foreground tabular-nums">
            {plural(notes.length, "note")}
            {due > 0 && ` · ${due} due`}
          </p>
        </div>
        <div className="flex gap-2">
          {topics.length > 0 && <NewTopicButton sectionId={section.id} />}
          <SectionMenu section={section} order={all.map((s) => s.id)} topicCount={topics.length} noteCount={notes.length} />
        </div>
      </div>

      {topics.length === 0 ? (
        <div className="grid justify-items-start gap-4 border-t pt-6">
          <p className="max-w-sm leading-relaxed text-muted-foreground">
            Start with a topic, like React or Two pointers. Then add notes inside it, by hand or from Claude.
          </p>
          <NewTopicButton sectionId={section.id} size="lg" />
        </div>
      ) : (
        <div className="rounded-[14px] border p-1.5">
          <TopicTree sectionId={section.id} topics={topics} editable />
        </div>
      )}
    </div>
  )
}
