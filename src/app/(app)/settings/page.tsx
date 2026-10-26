import type { ReactNode } from "react"
import { Bell, CalendarClock, Download, HardDriveDownload, Plug, UserRound } from "lucide-react"
import { ClaudeConnect } from "@/components/settings/claude-connect"
import { DailyMinutes } from "@/components/settings/daily-minutes"
import { Reminders } from "@/components/settings/reminders"
import { Button } from "@/components/ui/button"
import { listApiKeys } from "@/server/api-keys"
import { requireUser } from "@/server/session"
import { getSettings } from "@/server/settings"

export const metadata = { title: "Settings" }

function Card({ id, icon: Icon, title, subtitle, children }: { id?: string; icon: typeof Plug; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-24 gap-6 rounded-3xl border bg-card p-5 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-foreground text-background">
          <Icon className="size-5" />
        </span>
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

const shortDate = (d: Date, timeZone: string) => d.toLocaleDateString("en", { month: "short", day: "numeric", timeZone })

export default async function SettingsPage() {
  const user = await requireUser()
  const [settings, keys] = await Promise.all([getSettings(user.id), listApiKeys(user.id)])
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

      <Card id="claude" icon={Plug} title="Connect Claude" subtitle="Claude saves notes straight into your brain while you learn. Set it up once, in Claude Code.">
        <ClaudeConnect
          mcpUrl={`${appUrl}/api/mcp`}
          keys={keys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            createdAt: shortDate(k.createdAt, settings.timezone),
            lastUsedAt: k.lastUsedAt ? shortDate(k.lastUsedAt, settings.timezone) : null,
          }))}
        />
      </Card>

      <Card icon={CalendarClock} title="Daily review" subtitle="How long a day's review takes. Short and daily beats long and rare.">
        <DailyMinutes value={settings.dailyMinutes} />
      </Card>

      <Card icon={Bell} title="Reminders" subtitle="A nudge on your phone or laptop at the time you pick, only on days you have reviews.">
        <Reminders enabled={settings.remindersEnabled} time={settings.reminderTime} />
      </Card>

      <Card icon={HardDriveDownload} title="Your data" subtitle="Download everything: one Markdown file per note (opens in Obsidian) plus a full copy with your review history.">
        <div>
          <Button asChild variant="outline">
            <a href="/api/export" download>
              <Download /> Download my brain (.zip)
            </a>
          </Button>
        </div>
      </Card>

      <Card icon={UserRound} title="Account">
        <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="truncate">{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="truncate">{user.email}</dd>
          <dt className="text-muted-foreground">Time zone</dt>
          <dd>{settings.timezone.replace(/_/g, " ")}</dd>
        </dl>
      </Card>
    </div>
  )
}
