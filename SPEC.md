# Second Brain — Product Spec

Everything agreed so far. Build first; learning how it works comes later.

## Big picture

- A private website where everything I learn is saved, searchable, and reviewed daily so I never forget it.
- Main goal: **interviews**. I must be able to explain anything I learned, solve problems, and handle follow-ups well enough to impress a FAANG interviewer.
- I have ADHD: one clear thing per screen, always an obvious next step, no clutter.
- Every tech choice must be one I can explain and defend in an interview. Cost: **$0**.

## Hosting and accounts

- URL: `secondbrain.abulhassan.dev` (domain from name.com, hosted on Vercel, same setup as `debt.abulhassan.dev`).
- Code: **public** GitHub repo. Notes stay private in the database.
- Works on laptop and phone. Installable on the phone like an app.
- **Private, multi-user.** Login required. Each person gets their own empty second brain.
- Login: email + password (with verify-email and forgot-password emails), Google, GitHub.
- Data lives in a real database. Automatic daily backups + "download all my notes" export.

## Structure

- **Section → Topic → Note.** Example: Web Dev → React → useState.
- New users start with three sections: **Web Dev, DSA, AI**. Anyone can add, rename, or delete sections.
- My second brain starts **empty**. No imports from old notes.
- Notes can link to each other with `[[Note name]]`, like Obsidian, with backlinks.

## Every note has the same 4 steps

Same stepper feel as `100xDevs/Advance/notes-app`.

1. **Understand** — whatever it takes to fully understand it after reading: explanation, analogy, diagrams, tables, examples.
2. **Code** — code snippets with one short note per important part.
3. **Say it** — an interview answer good enough to impress a FAANG interviewer, made for practicing out loud. Has **key points** (used to grade reviews) and a read-aloud button.
4. **Test** — 3–4 different questions on the idea, plus interviewer follow-ups ("Why?", "What if…?").

## DSA notes

Two kinds, linked together (a problem says which pattern(s) it uses; a pattern lists all its problems):

- **Pattern** (e.g. Sliding Window): the idea, the **signals** that tell you to use it ("longest contiguous subarray → Sliding Window"), a template.
- **Problem** (e.g. Two Sum):
  - Problem text, pattern(s).
  - "Say it" follows real interview order: clarify → brute force → optimal → code → dry run → complexity → edge cases.
  - 2–3 follow-ups with answers ("What if sorted?", "O(1) space?").
  - Solution in **C++** + test cases.

## Adding notes

- **From Claude:** when I say I fully understand something, Claude sends the note straight to the site using my own secret key. Claude picks the section/topic; I can move it.
- Other users get their own key and a copy-paste setup text on their **Settings** page, so their own Claude can save to their brain.
- **By hand:** create and edit notes on the site. Editor works both ways, like Obsidian: `/` menu (Notion-style) and markdown shortcuts (`# ` → heading).

## Daily review (spaced repetition)

- Scheduling: **FSRS** (learns how fast I forget each note).
- Normal note review:
  1. See only a question (rotates between the note's questions).
  2. Answer **out loud**, without looking.
  3. **Voice check:** the browser listens and auto-ticks the key points I said (manual ticking as fallback).
  4. See the "Say it" answer and compare.
  5. Rating comes from the ticks: **Forgot / Shaky / Nailed it**.
  6. Sometimes an interviewer follow-up is asked.
- DSA problem review:
  1. Problem text only — **no title, no pattern**.
  2. Name the pattern first.
  3. Say the approach out loud (brute force → optimal → complexity).
  4. Write the C++ code with a **timer**. Too slow = Shaky.
  5. **Run** against test cases (free online compiler) → ✅ / ❌ per test.
  6. Compare with the saved solution **side by side**.
  7. Answer one follow-up.
- Reviews **mix** sections and patterns, like a real interview.
- **Daily limit** about 15 minutes; extra reviews spread over the next days.
- **Weak spots:** notes I keep forgetting get flagged. I can tell Claude "check my weak spots" and it re-teaches them differently.
- **Mock interview mode:** one button, random timed mix from all sections.
- **Streak + heatmap:** GitHub-style calendar of review days.
- **Reminder:** phone push notification every day at a time I choose.

## Homepage

- **Sections first** (Web Dev, DSA, AI…).
- Today's review card below the sections.
- A **Review** button with a count (e.g. `Review 5`) in the top bar on every page.

## Search

- `Ctrl+K` on laptop, search icon on phone, from any page.
- **Hybrid search:** Postgres full-text (words) + pgvector embeddings from a free self-hosted open-source model (meaning), merged with **Reciprocal Rank Fusion**. $0.

## Look and feel

- Same as `100xDevs/Advance/notes-app`: **black and white only**, **JetBrains Mono** everywhere, light/dark switch.
- Colors maybe later, on request — easy to revert if I don't like them.

## Tech choices (all $0)

| Part | Choice | Why it's defensible |
|---|---|---|
| App | Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn/ui | Full-stack React on Vercel, server components + server actions |
| Database | Postgres on **Neon** (prod), **PGlite** over a socket (local dev) | Real Postgres everywhere; pgvector + full-text built in |
| ORM | Drizzle | SQL-first, typed, no codegen step |
| Auth | Better Auth (email+password, Google, GitHub) | Self-hosted auth, sessions in our own DB |
| Email | Resend (free tier) | Verify-email + reset-password |
| Spaced repetition | `ts-fsrs` | FSRS, the algorithm Anki uses |
| Editor | Tiptap v3 + slash menu + Markdown in/out | `/` menu and `# ` shortcuts; notes stored as Markdown |
| Search | Postgres `tsvector` + pgvector, merged with RRF | Hybrid search |
| Embeddings | Open-source MiniLM (384-d) run with Transformers.js in a Web Worker | On-device, no API, no cost |
| Claude → site | Remote **MCP server** at `/api/mcp`, per-user API key (hashed) | Any MCP client can save notes |
| C++ runner | Server action → free Wandbox compiler (local `g++` in development) | Swappable adapter |
| Reminders | Web Push (VAPID) + service worker; GitHub Actions cron every 15 min | Vercel Hobby cron only runs once a day |
| Backups | GitHub Actions nightly `pg_dump`, **encrypted** before upload | Repo is public, so backups must be encrypted |

## Audit notes (known limits)

- iPhone push notifications only work after "Add to Home Screen" (iOS 16.4+). The app will show how.
- Voice check uses the browser's speech recognition: Chrome, Edge, Safari. Not Firefox → manual ticking still works.
- Claude connection v1 = Claude Code (API key header). claude.ai web connectors need OAuth → later.
- Meaning search downloads a ~23 MB model the first time search is opened, then it's cached. Word search works instantly meanwhile.
- C++ runner depends on a free public compiler service; if it's down, compare-with-solution still works. Not yet tried against Wandbox itself (tested with local `g++`).
- GitHub turns off scheduled workflows in a public repo after 60 days with no commits. If reminders stop, re-enable the workflow in the Actions tab (or move the 15-minute ping to cron-job.org).
- GitHub's scheduled jobs can start a few minutes late, so a reminder may arrive up to ~20 minutes after the chosen time.

## Build order

Steps 1 to 5 are built and tested locally. Step 6 is next.

1. Skeleton: auth, sections → topics → notes, 4-step note page, editor.
2. MCP server + API keys (Claude can save notes).
3. Daily review: FSRS, voice check, DSA flow, C++ runner.
4. Search (Ctrl+K, hybrid).
5. Push reminders, streak + heatmap, weak spots, mock interview, export + backups.
6. Deploy to `secondbrain.abulhassan.dev`.
