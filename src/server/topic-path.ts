import "server-only"
import { sql } from "drizzle-orm"

/** Separator between a topic and its subtopic: "React › Hooks". */
export const PATH_SEP = " › "

/** "React › Hooks" for a subtopic, "React" for a topic. Works in any query with `topics` (not aliased) in FROM. */
export const topicPath = sql<string>`coalesce((select p.name || ${PATH_SEP} from topics p where p.id = "topics"."parent_id"), '') || "topics"."name"`

/** The parent topic's name, or null for a top-level topic. Same FROM rule as `topicPath`. */
export const parentName = sql<string | null>`(select p.name from topics p where p.id = "topics"."parent_id")`

/** "React › Hooks" or "React > Hooks" → ["React", "Hooks"]. At most two levels; "/" stays in names like CI/CD. */
export function splitTopicPath(raw: string) {
  const parts = raw
    .split(/\s*[›>]\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length > 2 ? [parts[0], parts.slice(1).join(" ")] : parts
}
