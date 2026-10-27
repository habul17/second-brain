"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { setDailyMinutesAction } from "@/actions/settings"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Row, quietTrigger } from "./row"

const OPTIONS = [5, 10, 15, 20, 30]

export function DailyMinutes({ value }: { value: number }) {
  const [minutes, setMinutes] = useState(value)
  const [, startTransition] = useTransition()

  return (
    <Row label="Daily review">
      <Select
        value={String(minutes)}
        onValueChange={(v) => {
          const m = Number(v)
          setMinutes(m)
          startTransition(async () => {
            await setDailyMinutesAction(m)
            toast(`Daily review: about ${m} minutes`)
          })
        }}
      >
        <SelectTrigger aria-label="Minutes of review per day" className={quietTrigger}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {OPTIONS.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {m} min
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Row>
  )
}
