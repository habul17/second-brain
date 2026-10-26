"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { syncTimezoneAction } from "@/actions/settings"

/** Keeps the saved time zone in step with this device's clock. Renders nothing. */
export function TimezoneSync({ saved }: { saved: string }) {
  const router = useRouter()
  useEffect(() => {
    const current = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (current && current !== saved) {
      void syncTimezoneAction(current).then(() => router.refresh())
    }
  }, [saved, router])
  return null
}
