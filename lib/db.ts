import net from "node:net"
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
  const host = parsed.hostname
  const port = Number(parsed.port || 3306)

  return {
    host,
    port,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    // Dial IPv4 directly. The Hostinger host publishes both an A and an AAAA
    // record, and on Node 22 the driver's plain net.connect then goes through
    // "happy eyeballs": the first address gets a 250ms timer before Node moves
    // on. That timer is an ordinary setTimeout, so under load an event-loop
    // stall longer than 250ms kills the attempt even when the server answered
    // in time — and with no usable IPv6 route the fallback fails too. Every new
    // connection then dies with "connect ETIMEDOUT <ip>:3306" and the pool sits
    // at active=0 idle=0. This is why Railway (one busy long-lived process)
    // failed while Vercel did not.
    //
    // Railway private-network hosts are left to the OS: older Railway
    // environments resolve *.railway.internal to IPv6 only.
    ...(host.endsWith(".railway.internal")
      ? {}
      : {
          stream: (callback?: (error?: Error, socket?: net.Socket) => void) => {
            callback?.(undefined, net.connect({ host, port, family: 4 }))
          },
        }),
    // Small on purpose: capping here is what keeps the hourly quota from being
    // spent all at once. Every process (each Railway replica, every Vercel
    // instance) opens its own pool, and the total must stay under the server's
    // max_user_connections. Override with DATABASE_POOL_LIMIT once the database
    // is no longer on shared hosting.
    connectionLimit: Number(process.env.DATABASE_POOL_LIMIT) || 5,
    // The driver default is 1000ms and covers TCP, the login handshake and the
    // session init queries — several round trips to a server across the public
    // internet. Too tight once the 250ms timer above is out of the way.
    connectTimeout: 10_000,
    acquireTimeout: 20_000,
    // Before reusing a connection idle for more than minDelayValidation, the
    // pool pings it and *destroys* it if the ping misses pingTimeout. The
    // defaults (500ms / 250ms) meant almost every checkout was pinged, and a
    // busy event loop failed the ping on healthy sockets — turning load into
    // reconnects that each count against the hourly quota.
    minDelayValidation: 15_000,
    pingTimeout: 3_000,
    // Without a delay the driver uses the OS default keepalive (~2h on Linux),
    // which does nothing against a NAT dropping an idle connection silently.
    keepAliveDelay: 30_000,
    // The Hostinger server's wait_timeout is 20s: it hangs up on any connection
    // idle that long, and the pool immediately reopens it. minimumIdle defaults
    // to connectionLimit, so a quiet pool of 5 was reopening up to
    // 5 × 3600 / 20 = 900 connections an hour — past the 500/hour quota with no
    // traffic at all. Holding one idle connection caps that at ~180/hour, and
    // the extras are closed by us just before the server would.
    //
    // minimumIdle must stay >= 1: the pool only dials a new connection while
    // its idle count is below minimumIdle, so 0 would never grow at all.
    minimumIdle: 1,
    idleTimeout: 15,
    // The pool swallows its own errors and reports only the first one of a
    // failure streak, so a later quota (1226) or host-blocked (1129) error
    // would otherwise never reach the logs.
    logger: {
      error: (error: Error & { errno?: number; code?: string }) =>
        console.error("[mariadb]", error.errno, error.code, error.message),
      warning: (message: string) => console.warn("[mariadb]", message),
    },
  }
}

/**
 * Both the pool and the client are cached on globalThis, in production too.
 * Caching only the client is not enough: the adapter is constructed at module
 * scope, so every dev hot reload — or a second copy of this module in another
 * server bundle — would build another pool that then competes for the same
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
    transactionOptions: { timeout: 30_000, maxWait: 20_000 },
    ...(logQueries ? { log: [{ emit: "event", level: "query" } as const] } : {}),
  })

if (logQueries && !globalForPrisma.prisma) {
  // @ts-expect-error - the event map is only typed when `log` is statically known.
  prisma.$on("query", (event: { duration: number; query: string }) => {
    console.log("[prisma] " + event.duration + "ms  " + event.query.slice(0, 120))
  })
}

globalForPrisma.prisma = prisma
globalForPrisma.adapter = adapter
