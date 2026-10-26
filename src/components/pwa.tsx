"use client"

import { useEffect } from "react"

/** Registers the service worker: makes the site installable and lets reminders reach this device. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])
  return null
}
