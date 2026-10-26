import { Brain } from "lucide-react"

export function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2 font-semibold">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Brain className="size-4" />
      </span>
      {withName && <span className="truncate">Second Brain</span>}
    </span>
  )
}
