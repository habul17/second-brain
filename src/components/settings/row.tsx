import type { ReactNode } from "react"
import { cn } from "cn"

/** One settings line: the name on the left, its value or control on the right. Lines get a hairline between them. */
export const rowClass = "flex min-h-[54px] w-full min-w-0 items-center gap-3 py-2 text-left [&+&]:border-t"

// A quiet picker in a row: grey value and a chevron, no box.
export const quietTrigger =
  "h-auto! w-auto gap-1.5 border-0 bg-transparent! px-0 py-1 text-base text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 dark:bg-transparent!"

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)]">
      <h2 className="mb-0.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

export function Row({ label, sub, quiet, onClick, children }: { label: string; sub?: ReactNode; quiet?: boolean; onClick?: () => void; children?: ReactNode }) {
  const body = (
    <>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={cn("truncate", quiet ? "text-muted-foreground" : "font-semibold")}>{label}</span>
        {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
      </span>
      {children}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(rowClass, "transition-colors hover:text-foreground")}>
      {body}
    </button>
  ) : (
    <div className={rowClass}>{body}</div>
  )
}

/** The value shown on the right of a row. */
export function Value({ children }: { children: ReactNode }) {
  return <span className="min-w-0 truncate text-muted-foreground">{children}</span>
}
