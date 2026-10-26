import "server-only"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// Reuse one pool across hot reloads in dev and across invocations on a warm function.
const globalForDb = globalThis as unknown as { pool?: Pool }
const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
globalForDb.pool = pool

export const db = drizzle(pool, { schema })
export type DB = typeof db
