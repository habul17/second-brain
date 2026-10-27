"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Dumbbell, Flame, Swords } from "lucide-react"
import { PickGroup, PickRow, PickSheet } from "@/components/pick-sheet"
import { Button } from "@/components/ui/button"

/** Opens on its own when Home is reached as /?open=…; closing drops that from the address. */
function useSheet(startOpen: boolean) {
  const router = useRouter()
  const [open, setOpen] = useState(startOpen)
  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next && startOpen) router.replace("/", { scroll: false })
  }
  return { open, onOpenChange }
}

export function MockSheet({ startOpen, tooFew }: { startOpen: boolean; tooFew: boolean }) {
  return (
    <PickSheet
      {...useSheet(startOpen)}
      title="Mock interview"
      description="Pick a quick round or a full interview."
      trigger={
        <Button variant="outline" size="sm" className="font-medium">
          <Swords /> Mock interview
        </Button>
      }
    >
      {tooFew && <p className="px-5 pb-2 text-sm text-muted-foreground">Not enough notes for that yet. Add a few more first.</p>}
      <PickRow href="/mock?go=quick" name="Quick round" detail="5 questions" value="10 min" />
      <PickRow href="/mock?go=full" name="Full interview" detail="1 problem, then 4 questions" value="40 min" />
    </PickSheet>
  )
}

interface WeakNote {
  id: string
  title: string
  sectionName: string
  reason: string
}

export function WeakSheet({ notes, startOpen }: { notes: WeakNote[]; startOpen: boolean }) {
  const sections = [...new Set(notes.map((n) => n.sectionName))]
  const practice = notes.slice(0, 10)
  return (
    <PickSheet
      {...useSheet(startOpen)}
      title={
        <>
          Weak spots<span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{notes.length}</span>
        </>
      }
      description="Notes you keep forgetting, by section."
      trigger={
        <Button variant="outline" size="sm" className="font-medium">
          <Flame /> Weak spots <span className="text-muted-foreground tabular-nums">{notes.length}</span>
        </Button>
      }
    >
      <div className="grid max-h-[min(440px,55svh)] grid-cols-[minmax(0,1fr)] overflow-y-auto">
        {sections.map((section) => (
          <div key={section} className="grid grid-cols-[minmax(0,1fr)]">
            <PickGroup>{section}</PickGroup>
            {notes
              .filter((n) => n.sectionName === section)
              .map((n) => (
                <PickRow key={n.id} href={`/n/${n.id}`} name={n.title} value={n.reason.replace(/^Forgot (\d+) times$/, "Forgot $1×")} />
              ))}
          </div>
        ))}
      </div>
      <Button asChild size="lg" className="mx-3.5 mt-2 mb-1.5 h-12 rounded-xl text-base">
        <Link href={`/practice?notes=${practice.map((n) => n.id).join(",")}`}>
          <Dumbbell /> {practice.length === notes.length ? `Practice all ${notes.length}` : `Practice ${practice.length}`}
        </Link>
      </Button>
    </PickSheet>
  )
}
