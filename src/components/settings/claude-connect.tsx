"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2, Plus, Trash2 } from "lucide-react"
import { createApiKeyAction, revokeApiKeyAction } from "@/actions/settings"
import { CopyButton } from "@/components/copy-button"
import { ConfirmDelete } from "@/components/section-actions"
import { Button } from "@/components/ui/button"

interface Key {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3">
      <span className="grid size-7 place-items-center rounded-full bg-foreground font-mono text-xs text-background">{n}</span>
      <span className="self-center font-medium">{title}</span>
      {children && <div className="col-start-2 grid min-w-0 gap-3">{children}</div>}
    </li>
  )
}

export function ClaudeConnect({ keys, mcpUrl }: { keys: Key[]; mcpUrl: string }) {
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
    <div className="grid gap-8">
      <ol className="grid gap-7">
        <Step n={1} title="Make a key">
          {newKey ? (
            <div className="grid gap-2 rounded-2xl border-2 border-foreground p-4">
              <span className="text-sm font-medium">Your new key. It is shown only once.</span>
              <code className="font-mono text-xs break-all">{newKey}</code>
              <div>
                <CopyButton text={newKey} label="Copy key" />
              </div>
            </div>
          ) : (
            <div>
              <Button onClick={create} disabled={creating}>
                {creating ? <Loader2 className="animate-spin" /> : <Plus />} Make a key
              </Button>
            </div>
          )}
        </Step>
        <Step n={2} title="Run this once in your terminal">
          <pre className="overflow-x-auto rounded-2xl border bg-muted/50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
            {command}
          </pre>
          <div>
            <CopyButton text={command} label="Copy command" variant={newKey ? "default" : "outline"} />
          </div>
        </Step>
        <Step n={3} title="Learn with Claude as usual">
          <p className="text-sm leading-relaxed text-muted-foreground">
            When you fully understand something, say <span className="font-medium text-foreground">&quot;save this to my second brain&quot;</span>. Claude
            writes all 4 steps and puts the note in the right section.
          </p>
        </Step>
      </ol>

      {keys.length > 0 && (
        <div className="grid gap-3">
          <div className="text-sm font-medium text-muted-foreground">Your keys</div>
          <ul className="grid divide-y rounded-2xl border">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 px-4 py-3">
                <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-sm font-medium">{k.name}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {k.prefix}… · {k.lastUsedAt ? `last used ${k.lastUsedAt}` : "never used"}
                  </span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setRevoking(k)}>
                  <Trash2 /> Remove
                </Button>
              </li>
            ))}
          </ul>
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
