"use client"

import { useEffect, useId, useState } from "react"
import { useTheme } from "next-themes"

/**
 * Mermaid shrinks wide diagrams to any size to fit the box, which makes the text unreadable.
 * Let them shrink to 70% at most; past that the box scrolls.
 */
function readableSize(svg: string) {
  const max = svg.match(/max-width:\s*([\d.]+)px;?/)
  if (!max) return svg
  const width = Number(max[1])
  return svg.replace('width="100%"', `width="${width}"`).replace(max[0], `min-width: ${Math.round(width * 0.7)}px;`)
}

/** Phones: left-to-right flowcharts read better top-to-bottom. */
function fitPhone(code: string) {
  if (!window.matchMedia("(max-width: 39.99rem)").matches) return code
  return code.replace(/^(\s*(?:graph|flowchart)\s+)(LR|RL)\b/m, "$1TD")
}

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
        const { svg } = await mermaid.render(id, fitPhone(code))
        if (!cancelled) {
          setSvg(readableSize(svg))
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
      className="overflow-x-auto rounded-2xl border bg-card p-4 [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
