"use client"

import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { createSectionAction } from "@/actions/library"
import { NameDialog } from "@/components/name-dialog"

export function NewSectionRow() {
  const router = useRouter()
  return (
    <NameDialog
      title="New section"
      description="A big area you learn about, like System Design or Java."
      placeholder="System Design"
      submitLabel="Create section"
      onSubmit={async (name) => {
        const id = await createSectionAction(name)
        router.push(`/s/${id}`)
      }}
      trigger={
        <button
          type="button"
          className="flex min-h-13 w-full items-center gap-3.5 px-4 py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span className="grid size-[34px] shrink-0 place-items-center">
            <Plus className="size-[18px]" />
          </span>
          New section
        </button>
      }
    />
  )
}
