"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Loader2 } from "lucide-react"
import { createApiKeyAction, revokeApiKeyAction } from "@/actions/settings"
import { CopyButton } from "@/components/copy-button"
import { ConfirmDelete } from "@/components/section-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Row, Value } from "./row"

interface Key {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3.5 gap-y-2.5">
      <span className="grid size-6 place-items-center rounded-full border text-xs font-bold text-muted-foreground">{n}</span>
      <span className="self-center font-semibold">{title}</span>
      {children && <div className="col-start-2 grid min-w-0 justify-items-start gap-2.5">{children}</div>}
    </li>
  )
}

/** The "Connect Claude" settings row. Its steps open in a pop-up (straight away for /settings?open=claude). */
export function ConnectClaudeRow({ keys, mcpUrl, startOpen }: { keys: Key[]; mcpUrl: string; startOpen: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(startOpen)
  return (
    <>
      <Row label="Connect Claude" onClick={() => setOpen(true)}>
        <Value>{keys.length ? `${keys.length} key${keys.length === 1 ? "" : "s"}` : "Not set up"}</Value>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Row>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next && startOpen) router.replace("/settings", { scroll: false })
        }}
      >
        <DialogContent className="max-h-[calc(100svh-2rem)] gap-6 overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Claude</DialogTitle>
            <DialogDescription>Claude saves notes straight into your brain while you learn. Set it up once, in Claude Code.</DialogDescription>
          </DialogHeader>
          <ClaudeConnect keys={keys} mcpUrl={mcpUrl} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function ClaudeConnect({ keys, mcpUrl }: { keys: Key[]; mcpUrl: string }) {
  const router = useRouter()
  const [newKey, setNewKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<Key | null>(null)

  async function create() {
    setCreating(true)
    try {
      const device = /Mac/.test(navigator.userAgent) ? "Mac" : /Windows/.test(navigator.userAgent) ? "Windows" : "Linux"
      setNewKey(await createApiKeyAction(`Claude Code (${device})`))
      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  const command = `claude mcp add --transport http --scope user second-brain ${mcpUrl} --header "Authorization: Bearer ${newKey ?? "YOUR_KEY"}"`

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <ol className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <Step n={1} title="Make a key">
          {newKey ? (
            <>
              <span className="text-sm text-muted-foreground">Your new key. It is shown only once.</span>
              <code className="w-full rounded-[10px] border bg-card px-3 py-2.5 font-mono text-xs break-all">{newKey}</code>
              <CopyButton text={newKey} label="Copy key" />
            </>
          ) : (
            <Button onClick={create} disabled={creating}>
              {creating && <Loader2 className="animate-spin" />} Make a key
            </Button>
          )}
        </Step>
        <Step n={2} title="Run this once in your terminal">
          <pre className="w-full overflow-x-auto rounded-[10px] border bg-card px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">{command}</pre>
          <CopyButton text={command} label="Copy command" variant={newKey ? "default" : "outline"} />
        </Step>
        <Step n={3} title="Learn with Claude as usual">
          <p className="text-sm leading-relaxed text-muted-foreground">
            When you fully understand something, say <span className="font-semibold text-foreground">&quot;save this to my second brain&quot;</span>. Claude
            writes all 4 steps and puts the note in the right section.
          </p>
        </Step>
      </ol>

      {keys.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)]">
          <h3 className="mb-0.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">Your keys</h3>
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 py-2.5 [&+&]:border-t">
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-semibold">{k.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {k.prefix}… · {k.lastUsedAt ? `last used ${k.lastUsedAt}` : "never used"}
                </span>
              </span>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setRevoking(k)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDelete
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={`Remove "${revoking?.name}"?`}
        description="Claude stops being able to save notes with this key. You can make a new one any time."
        onConfirm={async () => {
          if (revoking) await revokeApiKeyAction(revoking.id)
          router.refresh()
        }}
      />
    </div>
  )
}
