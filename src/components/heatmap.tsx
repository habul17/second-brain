import { cn } from "cn"

interface Props {
  cells: { day: string; n: number }[]
}

function level(n: number) {
  if (n === 0) return "bg-muted"
  if (n < 5) return "bg-foreground/25"
  if (n < 10) return "bg-foreground/50"
  if (n < 20) return "bg-foreground/75"
  return "bg-foreground"
}

function label(day: string, n: number) {
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })
  return `${date}: ${n === 0 ? "no reviews" : n === 1 ? "1 review" : `${n} reviews`}`
}

/** One square per day, a column per week (Sunday on top), darker = more reviews. */
export function Heatmap({ cells }: Props) {
  const offset = cells.length ? new Date(`${cells[0].day}T12:00:00Z`).getUTCDay() : 0
  const weeks = Math.ceil((offset + cells.length) / 7)
  const total = cells.reduce((sum, c) => sum + c.n, 0)

  return (
    <div className="grid w-full max-w-fit gap-3">
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 14px))`, gridTemplateRows: "repeat(7, auto)", gridAutoFlow: "column" }}
        role="img"
        aria-label={`${total} reviews in the last ${Math.round(cells.length / 30)} months`}
      >
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {cells.map((c) => (
          <span key={c.day} title={label(c.day, c.n)} className={cn("aspect-square rounded-[3px]", level(c.n))} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {total} {total === 1 ? "review" : "reviews"} in the last 6 months
        </span>
        <span className="flex items-center gap-1" aria-hidden>
          Less
          {[0, 1, 5, 10, 20].map((n) => (
            <span key={n} className={cn("size-2.5 rounded-[2px]", level(n))} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}
