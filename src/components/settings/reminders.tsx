"use client"

import { useState, useSyncExternalStore } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { disableRemindersAction, enableRemindersAction, sendTestPushAction, setReminderTimeAction } from "@/actions/settings"
import { Switch } from "@/components/ui/switch"
import { Row } from "./row"

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
    return <Row label="Reminder" sub="On iPhone, first tap Share › Add to Home Screen. Open the app from there and turn this on." />
  }
  if (support === "no") {
    return <Row label="Reminder" sub="This browser can't show reminders. Try Chrome, Edge or Safari." />
  }

  return (
    <>
      <Row label="Reminder" sub={!enabled && "Only on days you have notes due."}>
        {enabled && (
          <input
            type="time"
            step={900}
            value={time}
            aria-label="Remind me at"
            onChange={async (e) => {
              setTime(e.target.value)
              if (/^\d\d:\d\d$/.test(e.target.value)) await setReminderTimeAction(e.target.value)
            }}
            className="bg-transparent text-muted-foreground tabular-nums outline-none"
          />
        )}
        {busy ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <Switch checked={enabled} onCheckedChange={toggle} aria-label="Daily reminder" />}
      </Row>
      {enabled && (
        <Row
          label="Send a test reminder"
          quiet
          onClick={async () => {
            const sent = await sendTestPushAction().catch(() => 0)
            toast(sent ? "Test sent. It should pop up in a few seconds." : "No device got it. Turn the reminder off and on again.")
          }}
        />
      )}
    </>
  )
}
