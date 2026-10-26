"use client"

import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { createSectionAction } from "@/actions/library"
import { NameDialog } from "@/components/name-dialog"

export function NewSectionCard() {
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
          className="grid min-h-14 place-items-center gap-2 rounded-3xl border border-dashed p-4 text-muted-foreground sm:min-h-40 sm:p-6 transition-colors hover:border-foreground/50 hover:bg-muted/50 hover:text-foreground"
        >
          <span className="flex items-center gap-2 font-medium">
            <Plus className="size-4" /> New section
          </span>
        </button>
      }
    />
  )
}
