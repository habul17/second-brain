"use client"

import { useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { authClient } from "@/lib/auth-client"
import { Row, quietTrigger } from "./row"

const noop = () => () => {}

export function ThemeRow() {
  const { theme, setTheme } = useTheme()
  // The saved theme is only known in the browser.
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  return (
    <Row label="Theme">
      {mounted && (
        <Select value={theme ?? "system"} onValueChange={setTheme}>
          <SelectTrigger aria-label="Theme" className={quietTrigger}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            <SelectItem value="system">Auto</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      )}
    </Row>
  )
}

export function LogOutRow() {
  const router = useRouter()
  return (
    <Row
      label="Log out"
      quiet
      onClick={async () => {
        await authClient.signOut()
        router.replace("/login")
        router.refresh()
      }}
    />
  )
}
