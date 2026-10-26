import { sql } from "drizzle-orm"
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core"

// ─── Auth (shape required by Better Auth) ────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
)

// ─── Second brain ────────────────────────────────────────────────────────────

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
})

export type NoteKind = "concept" | "pattern" | "problem"
export type Difficulty = "easy" | "medium" | "hard"

export interface CodeSnippet {
  file: string
  code: string
  /** One short line per important part of the code. */
  notes?: string[]
}

export interface QA {
  q: string
  a: string
}

export interface TestCase {
  input: string
  expected: string
}

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sections_user_idx").on(t.userId, t.position)],
)

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("topics_section_idx").on(t.sectionId, t.position), index("topics_user_idx").on(t.userId)],
)

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    kind: text("kind").$type<NoteKind>().notNull().default("concept"),
    title: text("title").notNull(),

    // The 4 steps
    understand: text("understand").notNull().default(""),
    code: jsonb("code").$type<CodeSnippet[]>().notNull().default([]),
    sayIt: text("say_it").notNull().default(""),
    keyPoints: jsonb("key_points").$type<string[]>().notNull().default([]),
    questions: jsonb("questions").$type<QA[]>().notNull().default([]),
    followUps: jsonb("follow_ups").$type<QA[]>().notNull().default([]),

    // DSA pattern: what tells you to reach for it
    signals: jsonb("signals").$type<string[]>().notNull().default([]),
    // DSA problem
    statement: text("statement").notNull().default(""),
    difficulty: text("difficulty").$type<Difficulty>(),
    link: text("link"),
    starterCode: text("starter_code").notNull().default(""),
    solution: text("solution").notNull().default(""),
    /** C++ `main` that reads a test's input, calls the solution and prints the result. */
    harness: text("harness").notNull().default(""),
    testCases: jsonb("test_cases").$type<TestCase[]>().notNull().default([]),
    /** Pattern titles this problem asked for, kept so a pattern note created later links up. */
    patternTitles: jsonb("pattern_titles").$type<string[]>().notNull().default([]),
    timeLimitMin: integer("time_limit_min"),

    search: tsvector("search").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
          setweight(to_tsvector('english', coalesce("say_it", '') || ' ' || coalesce("statement", '') || ' ' || coalesce("key_points"::text, '') || ' ' || coalesce("signals"::text, '')), 'B') ||
          setweight(to_tsvector('english', coalesce("understand", '') || ' ' || coalesce("questions"::text, '') || ' ' || coalesce("follow_ups"::text, '')), 'C') ||
          setweight(to_tsvector('english', coalesce("code"::text, '') || ' ' || coalesce("solution", '')), 'D')`,
    ),
    embedding: vector("embedding", { dimensions: 384 }),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notes_user_idx").on(t.userId, t.updatedAt),
    index("notes_topic_idx").on(t.topicId),
    uniqueIndex("notes_user_title_idx").on(t.userId, sql`lower(${t.title})`),
    index("notes_search_idx").using("gin", t.search),
    index("notes_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
)

/** DSA: which patterns a problem uses. */
export const notePatterns = pgTable(
  "note_patterns",
  {
    problemId: uuid("problem_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    patternId: uuid("pattern_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.problemId, t.patternId] }), index("note_patterns_pattern_idx").on(t.patternId)],
)

/** `[[Note title]]` links, rebuilt every time a note is saved. */
export const noteLinks = pgTable(
  "note_links",
  {
    fromId: uuid("from_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    toId: uuid("to_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.fromId, t.toId] }), index("note_links_to_idx").on(t.toId)],
)

/** FSRS memory state, one card per note. */
export const cards = pgTable(
  "cards",
  {
    noteId: uuid("note_id")
      .primaryKey()
      .references(() => notes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    due: timestamp("due", { withTimezone: true }).notNull(),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: smallint("state").notNull().default(0),
    lastReview: timestamp("last_review", { withTimezone: true }),
  },
  (t) => [index("cards_user_due_idx").on(t.userId, t.due)],
)

export type ReviewMode = "daily" | "mock" | "practice"

/** Every review ever done: drives the streak, heatmap and weak spots. */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    /** FSRS rating: 1 Forgot, 2 Shaky, 3 Nailed it. */
    rating: smallint("rating").notNull(),
    mode: text("mode").$type<ReviewMode>().notNull().default("daily"),
    prompt: text("prompt").notNull().default(""),
    /** Share of key points said (0–1). */
    score: real("score"),
    durationMs: integer("duration_ms"),
    patternCorrect: boolean("pattern_correct"),
    testsPassed: integer("tests_passed"),
    testsTotal: integer("tests_total"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reviews_user_time_idx").on(t.userId, t.reviewedAt), index("reviews_note_idx").on(t.noteId)],
)

/** Keys that let Claude (or any MCP client) write to one person's brain. Only the hash is stored. */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    hash: text("hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("api_keys_user_idx").on(t.userId)],
)

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_user_idx").on(t.userId)],
)

export const settings = pgTable("settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("UTC"),
  /** Local time "HH:MM" for the daily reminder. */
  reminderTime: text("reminder_time").notNull().default("20:00"),
  remindersEnabled: boolean("reminders_enabled").notNull().default(false),
  dailyMinutes: integer("daily_minutes").notNull().default(15),
  /** Local date (YYYY-MM-DD) of the last reminder sent, so we send at most one a day. */
  lastRemindedOn: text("last_reminded_on"),
})
