import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { PrismaClient } from "@/lib/generated/prisma/client"

/**
 * Pool settings are derived from DATABASE_URL so it stays the single source of
 * truth — the Prisma CLI reads the same variable via prisma.config.ts.
 *
 * The limits matter here: Hostinger's shared MariaDB enforces a
 * max_connections_per_hour quota (500 on this plan) alongside a low concurrent
 * cap. That quota counts every *new* connection, so the pool must stay small
 * and hold what it opens — a large pool spends the whole hourly allowance in
 * minutes and then fails every query with ER_USER_LIMIT_REACHED for the rest
 * of the hour.
 */
function poolConfig() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")

  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    // Small on purpose. This app is request-scoped and low-concurrency; five
    // connections comfortably serve it, and capping here is what keeps the
    // hourly quota from being spent all at once.
    connectionLimit: 5,
    // Must stay *below* the server's wait_timeout. If the server hangs up
    // first, the pool silently reopens the connection and that reopen counts
    // against the quota — so a too-long idle window burns it rather than
    // conserving it.
    idleTimeout: 60,
    acquireTimeout: 15_000,
  }
}

/**
 * Both the pool and the client are cached on globalThis. Caching only the
 * client is not enough: the adapter is constructed at module scope, so every
 * dev hot reload would build another pool that then competes for the same
 * quota.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  adapter?: PrismaMariaDb
}

const adapter = globalForPrisma.adapter ?? new PrismaMariaDb(poolConfig())

/**
 * Set PRISMA_LOG_QUERIES=true to print every statement and its duration.
 *
 * Worth reaching for whenever a page feels slow: against a shared host across
 * the public internet the cost of a render is the *number* of round trips far
 * more than the cost of any one of them, and that number is not obvious from
 * reading the code — Prisma turns a nested `include` into several queries.
 */
const logQueries = process.env.PRISMA_LOG_QUERIES === "true"

/**
 * The 5s default transaction budget assumes a local database. This one is a
 * shared host across the public internet, where a multi-statement save spends
 * most of its time in round-trip latency rather than in the database. Writers
 * are batched so they no longer approach even the default, but the ceiling is
 * raised as a backstop so a slow link degrades into a slow save instead of a
 * failed one. maxWait covers waiting for a connection from the small pool above.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    transactionOptions: { timeout: 30_000, maxWait: 15_000 },
    ...(logQueries ? { log: [{ emit: "event", level: "query" } as const] } : {}),
  })

if (logQueries && !globalForPrisma.prisma) {
  // @ts-expect-error - the event map is only typed when `log` is statically known.
  prisma.$on("query", (event: { duration: number; query: string }) => {
    console.log("[prisma] " + event.duration + "ms  " + event.query.slice(0, 120))
  })
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.adapter = adapter
}
