import "server-only"
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from "ts-fsrs"
import type { cards } from "@/db/schema"

type CardRow = typeof cards.$inferSelect

// Whole days only: "Forgot" brings a note back tomorrow, not in 10 minutes.
const scheduler = fsrs(
  generatorParameters({ request_retention: 0.9, maximum_interval: 365, enable_fuzz: true, enable_short_term: false }),
)

const DAY = 24 * 60 * 60 * 1000

/** A brand-new note is first reviewed tomorrow: today you just learned it. */
export function newCard(now = new Date()) {
  const c = createEmptyCard(now)
  return fromFsrs({ ...c, due: new Date(now.getTime() + DAY) })
}

/** 1 = Forgot, 2 = Shaky, 3 = Nailed it */
export type ReviewRating = 1 | 2 | 3

const GRADE: Record<ReviewRating, Grade> = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good }

export function schedule(row: CardRow, rating: ReviewRating, now = new Date()) {
  const { card } = scheduler.next(toFsrs(row), now, GRADE[rating])
  return fromFsrs(card)
}

/** What each answer would do, e.g. { 1: 1, 2: 3, 3: 8 } days. Shown under the buttons. */
export function previewDays(row: CardRow, now = new Date()) {
  const preview = scheduler.repeat(toFsrs(row), now)
  const days = (r: Grade) => Math.max(1, Math.round((preview[r].card.due.getTime() - now.getTime()) / DAY))
  return { 1: days(Rating.Again), 2: days(Rating.Hard), 3: days(Rating.Good) } as Record<ReviewRating, number>
}

function toFsrs(row: CardRow): Card {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.lastReview ?? undefined,
  }
}

function fromFsrs(c: Card) {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    lastReview: c.last_review ?? null,
  }
}
