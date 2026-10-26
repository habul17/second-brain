// Local Postgres for development: PGlite (Postgres compiled to WASM) behind a socket,
// so the app talks to it with the same `pg` driver it uses for Neon in production.
import { PGlite } from "@electric-sql/pglite"
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm"
import { vector } from "@electric-sql/pglite-pgvector"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"

const port = Number(process.env.DEV_DB_PORT ?? 5433)
const db = await PGlite.create("./.data/pglite", { extensions: { vector, pg_trgm } })
await db.exec("CREATE EXTENSION IF NOT EXISTS vector")

const server = new PGLiteSocketServer({ db, port, maxConnections: 20 })
await server.start()
console.log(`Dev database on postgresql://postgres@127.0.0.1:${port}/postgres`)

async function stop() {
  await server.stop()
  await db.close()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
