import "server-only"
import { sql } from "drizzle-orm"
import { db } from "@/db"

export type SearchHit = {
  id: string
  title: string
  kind: string
  topicName: string
  sectionName: string
  /** Which retrievers found it: "words", "typo", "meaning". */
  via: string[]
}

/** Each partial word becomes a prefix match, so "jwt tok" finds "JWT tokens" while typing. */
function prefixQuery(q: string) {
  const words = q
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#]+/u)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
  return words.map((w) => `${w}:*`).join(" & ")
}

// Reciprocal Rank Fusion constant: dampens how much rank #1 beats rank #2 in any single list.
const RRF_K = 60

/**
 * Hybrid search. Three ranked lists, each best-first:
 *   words   – Postgres full-text (title > answer > explanation > code)
 *   typo    – trigram similarity on the title ("jwtt" still finds "JWT")
 *   meaning – pgvector cosine distance, when the browser sent a query embedding
 * merged with Reciprocal Rank Fusion: score = Σ 1 / (k + rank).
 */
export async function searchNotes(userId: string, q: string, embedding?: number[] | null, limit = 12) {
  const raw = q.trim()
  if (!raw) return []
  const tsq = prefixQuery(raw)
  const vec = embedding?.length === 384 ? `[${embedding.join(",")}]` : null

  const { rows } = await db.execute<SearchHit & { score: number }>(sql`
    with words as (
      select id, row_number() over (order by ts_rank_cd(search, query) desc) as r, 'words' as via
      from notes, to_tsquery('english', ${tsq}) as query
      where ${tsq} <> '' and user_id = ${userId} and search @@ query
      order by r limit 30
    ),
    typo as (
      select id, row_number() over (order by word_similarity(${raw}, title) desc) as r, 'typo' as via
      from notes
      where user_id = ${userId} and word_similarity(${raw}, title) > 0.35
      order by r limit 30
    ),
    meaning as (
      select id, row_number() over (order by embedding <=> ${vec}::vector) as r, 'meaning' as via
      from notes
      where ${vec}::text is not null and user_id = ${userId} and embedding is not null
        and embedding <=> ${vec}::vector < 0.75
      order by r limit 30
    ),
    fused as (
      select id, sum(1.0 / (${RRF_K} + r)) as score, array_agg(distinct via) as via
      from (select * from words union all select * from typo union all select * from meaning) hits
      group by id
    )
    select n.id, n.title, n.kind, coalesce((select p.name || ' › ' from topics p where p.id = t.parent_id), '') || t.name as "topicName", s.name as "sectionName", f.via, f.score
    from fused f
    join notes n on n.id = f.id
    join topics t on t.id = n.topic_id
    join sections s on s.id = t.section_id
    order by f.score desc
    limit ${limit}
  `)
  return rows.map(({ score: _score, ...hit }) => hit)
}

/** Notes that still need an embedding (new or edited since). The browser computes and sends them back. */
export async function notesNeedingEmbedding(userId: string, limit = 20) {
  const { rows } = await db.execute<{ id: string; text: string }>(sql`
    select id, title || E'\n' || say_it || E'\n' || statement || E'\n' || left(understand, 2000) as text
    from notes
    where user_id = ${userId} and embedding is null
    order by updated_at desc
    limit ${limit}
  `)
  return rows
}

export async function saveEmbeddings(userId: string, items: { id: string; embedding: number[] }[]) {
  for (const item of items) {
    if (item.embedding.length !== 384 || !item.embedding.every(Number.isFinite)) continue
    await db.execute(sql`
      update notes set embedding = ${`[${item.embedding.join(",")}]`}::vector, embedded_at = now()
      where id = ${item.id} and user_id = ${userId}
    `)
  }
}
