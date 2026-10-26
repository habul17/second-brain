"use client"

import { useState, useTransition } from "react"
import { cn } from "cn"
import { toast } from "sonner"
import { setDailyMinutesAction } from "@/actions/settings"

const OPTIONS = [5, 10, 15, 20, 30]

export function DailyMinutes({ value }: { value: number }) {
  const [minutes, setMinutes] = useState(value)
  const [, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Minutes of review per day">
      {OPTIONS.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={minutes === m}
          onClick={() => {
            setMinutes(m)
            startTransition(async () => {
              await setDailyMinutesAction(m)
              toast(`Daily review: about ${m} minutes`)
            })
          }}
          className={cn(
            "min-w-16 rounded-xl border px-4 py-2.5 font-mono text-sm tabular-nums transition-colors",
            minutes === m ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
          )}
        >
          {m} min
        </button>
      ))}
    </div>
  )
}
