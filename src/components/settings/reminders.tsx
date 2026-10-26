"use client"

import { useState, useSyncExternalStore } from "react"
import { Bell, BellOff, Loader2, Send, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { disableRemindersAction, enableRemindersAction, sendTestPushAction, setReminderTimeAction } from "@/actions/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

type Support = "yes" | "ios-install" | "no" | "unknown"

function detect(): Support {
  const canPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  if (canPush) return "yes"
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  return iOS ? "ios-install" : "no"
}

const noop = () => () => {}

/** VAPID public key (base64url) → bytes, as the Push API wants it. */
function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

export function Reminders({ enabled: initialEnabled, time: initialTime }: { enabled: boolean; time: string }) {
  const support = useSyncExternalStore(noop, detect, () => "unknown" as Support)
  const [enabled, setEnabled] = useState(initialEnabled)
  const [time, setTime] = useState(initialTime)
  const [busy, setBusy] = useState(false)

  async function turnOn() {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      toast("Notifications are blocked. Allow them for this site in your browser settings.")
      return
    }
    const reg = await navigator.serviceWorker.register("/sw.js")
    await navigator.serviceWorker.ready
    // Some browsers (e.g. Brave with push off) never answer; don't spin forever.
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15_000))
    const sub = await Promise.race([
      reg.pushManager.getSubscription().then(
        (existing) =>
          existing ?? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) }),
      ),
      timeout,
    ])
    await enableRemindersAction(sub.toJSON() as Parameters<typeof enableRemindersAction>[0], time)
    setEnabled(true)
    toast(`Reminder set for ${time} every day`)
  }

  async function toggle(on: boolean) {
    setBusy(true)
    try {
      if (on) await turnOn()
      else {
        await disableRemindersAction()
        setEnabled(false)
      }
    } catch {
      toast("Couldn't turn on reminders on this device.")
    } finally {
      setBusy(false)
    }
  }

  if (support === "ios-install") {
    return (
      <div className="flex gap-3 rounded-2xl border border-dashed p-4 text-sm leading-relaxed">
        <Smartphone className="mt-0.5 size-5 shrink-0" />
        <p>
          On iPhone, first add Second Brain to your Home Screen: tap <span className="font-medium">Share</span>, then{" "}
          <span className="font-medium">Add to Home Screen</span>. Open it from there and turn this on.
        </p>
      </div>
    )
  }
  if (support === "no") {
    return <p className="text-sm text-muted-foreground">This browser can&apos;t show reminders. Try Chrome, Edge, or Safari.</p>
  }

  return (
    <div className="grid gap-5">
      <label htmlFor="reminders" className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4">
        <span className="flex items-center gap-3">
          {enabled ? <Bell className="size-5" /> : <BellOff className="size-5 text-muted-foreground" />}
          <span className="grid">
            <span className="font-medium">Daily reminder on this device</span>
            <span className="text-xs text-muted-foreground">Only when you have notes due.</span>
          </span>
        </span>
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Switch id="reminders" checked={enabled} onCheckedChange={toggle} />}
      </label>

      {enabled && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="reminder-time" className="text-sm text-muted-foreground">
              Remind me at
            </label>
            <Input
              id="reminder-time"
              type="time"
              step={900}
              value={time}
              onChange={async (e) => {
                setTime(e.target.value)
                if (/^\d\d:\d\d$/.test(e.target.value)) await setReminderTimeAction(e.target.value)
              }}
              className="h-10 w-36 font-mono"
            />
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              const sent = await sendTestPushAction().catch(() => 0)
              toast(sent ? "Test sent. It should pop up in a few seconds." : "No device got it. Turn the reminder off and on again.")
            }}
          >
            <Send /> Send a test
          </Button>
        </div>
      )}
    </div>
  )
}
