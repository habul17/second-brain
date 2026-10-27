import { Download } from "lucide-react"
import { LogOutRow, ThemeRow } from "@/components/settings/account-rows"
import { ConnectClaudeRow } from "@/components/settings/claude-connect"
import { DailyMinutes } from "@/components/settings/daily-minutes"
import { Reminders } from "@/components/settings/reminders"
import { Group, Row, Value, rowClass } from "@/components/settings/row"
import { listApiKeys } from "@/server/api-keys"
import { requireUser } from "@/server/session"
import { getSettings } from "@/server/settings"

export const metadata = { title: "Settings" }

const shortDate = (d: Date, timeZone: string) => d.toLocaleDateString("en", { month: "short", day: "numeric", timeZone })

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await requireUser()
  const [settings, keys, params] = await Promise.all([getSettings(user.id), listApiKeys(user.id), searchParams])
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  return (
    <div className="mx-auto grid w-full max-w-[640px] grid-cols-[minmax(0,1fr)] gap-[30px]">
      <h1 className="text-[1.75rem] font-bold tracking-tight">Settings</h1>

      <Group title="Review">
        <DailyMinutes value={settings.dailyMinutes} />
        <Reminders enabled={settings.remindersEnabled} time={settings.reminderTime} />
      </Group>

      <Group title="Notes">
        <ConnectClaudeRow
          startOpen={params.open === "claude"}
          mcpUrl={`${appUrl}/api/mcp`}
          keys={keys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            createdAt: shortDate(k.createdAt, settings.timezone),
            lastUsedAt: k.lastUsedAt ? shortDate(k.lastUsedAt, settings.timezone) : null,
          }))}
        />
        {/* One Markdown file per note (opens in Obsidian), plus a full copy with review history. */}
        <a href="/api/export" download className={rowClass}>
          <span className="flex-1 font-semibold">Download all notes</span>
          <Value>.zip</Value>
          <Download className="size-4 shrink-0 text-muted-foreground" />
        </a>
      </Group>

      <Group title="Account">
        <Row label="Name">
          <Value>{user.name}</Value>
        </Row>
        <Row label="Email">
          <Value>{user.email}</Value>
        </Row>
        <Row label="Time zone">
          <Value>{settings.timezone.replace(/_/g, " ")}</Value>
        </Row>
        <ThemeRow />
        <LogOutRow />
      </Group>
    </div>
  )
}
