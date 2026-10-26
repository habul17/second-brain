# Second Brain

Everything I learn, saved in one place, searchable, and brought back by spaced repetition so I can explain it in an interview.

**Live:** [secondbrain.abulhassan.dev](https://secondbrain.abulhassan.dev)

## What it does

- **Sections → topics → notes**, linked with `[[Note title]]` and backlinks.
- **Every note has 4 steps:** Understand, Code, Say it (the answer to give out loud in an interview), Test (questions + interviewer follow-ups).
- **Daily review with FSRS** (the scheduler Anki uses). You see only the question, answer out loud, and a **voice check** ticks off the key points you hit. Questions rotate so you can't memorise one answer.
- **DSA practice like a real interview:** read the problem (title hidden), name the pattern, say the approach, code it in C++ against a timer, run the tests, compare with the saved solution, answer a follow-up.
- **Hybrid search (Ctrl K):** Postgres full-text + trigram typo matching + vector search by meaning, merged with Reciprocal Rank Fusion.
- **Claude can save notes directly** through an MCP server, authenticated with a per-user API key.
- Weak spots, mock interviews, streak + heatmap, daily push reminders, installable as an app, full export.

## How it's built

| Part | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router, server actions), React 19, TypeScript | One full-stack codebase on Vercel |
| UI | Tailwind v4, shadcn/ui, Motion | Accessible components, black-and-white design |
| Database | Postgres (Neon) with pgvector + pg_trgm, Drizzle ORM | One database does relational data, full-text, fuzzy and vector search |
| Local DB | PGlite (Postgres in WebAssembly) over a socket | Real Postgres locally with no Docker |
| Auth | Better Auth: email + password, Google, GitHub | Sessions in my own database |
| Scheduling | `ts-fsrs` | Models memory per note; ~20–30% fewer reviews than SM-2 for the same recall |
| Embeddings | MiniLM-L6 (384-d) via Transformers.js in a Web Worker | Computed on the user's device: no API bill, nothing sent to a third party |
| Editor | Tiptap v3 with a `/` menu and Markdown shortcuts | Notes stored as Markdown |
| Claude integration | MCP server (`mcp-handler`) at `/api/mcp` | Keys stored as SHA-256 hashes only |
| C++ runner | Compiler Explorer in production (Wandbox as backup), local `g++` in development | One compile runs every test |
| Reminders | Web Push (VAPID) + service worker; GitHub Actions every 15 min | Vercel's free cron runs once a day |
| Backups | Nightly `pg_dump`, AES-256 encrypted, stored as a GitHub artifact | The repo is public |

Total running cost: $0.

## Run it locally

```bash
pnpm install
cp .env.example .env.local      # then fill in the secrets
pnpm dev:db                     # Postgres (PGlite) on :5433, keep it running
pnpm db:migrate
pnpm dev                        # http://localhost:3000
```

Without email set up, the "Forgot password?" link is hidden.

### Connect Claude Code

Settings → Connect Claude → make a key, then run the command it shows:

```bash
claude mcp add --transport http --scope user second-brain https://secondbrain.abulhassan.dev/api/mcp \
  --header "Authorization: Bearer sb_…"
```

## Project layout

```
src/app          routes (pages, API routes, MCP endpoint)
src/actions      server actions called from the UI
src/server       data access and domain logic (notes, review, search, push, runner)
src/components   UI
src/lib          shared client/server helpers (schemas, voice check, embeddings)
src/db           Drizzle schema
drizzle/         SQL migrations
```

The full product spec is in [SPEC.md](SPEC.md).
