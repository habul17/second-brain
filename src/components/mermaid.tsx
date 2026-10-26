"use client"

import { useEffect, useId, useState } from "react"
import { useTheme } from "next-themes"

/** Draws a ```mermaid diagram. The library (~600 KB) loads only when a note has one. */
export function Mermaid({ code }: { code: string }) {
  const { resolvedTheme } = useTheme()
  const id = `mmd-${useId().replace(/:/g, "")}`
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: resolvedTheme === "dark" ? "dark" : "neutral",
          fontFamily: "JetBrains Mono Variable, monospace",
        })
        const { svg } = await mermaid.render(id, code)
        if (!cancelled) {
          setSvg(svg)
          setFailed(false)
        }
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [code, id, resolvedTheme])

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded-2xl border bg-muted/50 p-4 text-xs">
        <code>{code}</code>
      </pre>
    )
  }
  if (!svg) return <div className="h-40 animate-pulse rounded-2xl bg-muted" aria-label="Loading diagram" />
  return (
    <div
      className="grid justify-center overflow-x-auto rounded-2xl border bg-card p-4 [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
