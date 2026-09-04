# syntax=docker/dockerfile:1

# Node 22 satisfies both floors: next 16 wants >=20.9, prisma 7 wants
# ^20.19 || ^22.12 || >=24.
ARG NODE_VERSION=22-alpine

# ---------------------------------------------------------------------------
# deps — the full tree (devDependencies included), because the build needs
# typescript, tailwind and eslint-config-next.
#
# --ignore-scripts skips the `postinstall` hook: it runs `prisma generate`,
# which needs prisma/schema.prisma, and only package.json has been copied at
# this point. `npm run build` runs the same generate later, so nothing is lost.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---------------------------------------------------------------------------
# builder — `prisma generate && next build` (the project's own build script).
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# lib/db.ts parses DATABASE_URL at module scope, and `next build` imports that
# module while collecting page data — so the build needs *a* URL, not the real
# one. Nothing connects: the mariadb pool only dials on its first query.
#
# Do not pass real credentials through this ARG. Build arguments are recorded
# in the image's layer history and are readable by anyone who pulls it.
ARG DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------------------------------------------------------------------------
# runner — production dependencies plus the build output.
#
# This ships the traced-free full production node_modules rather than
# `output: "standalone"`. Standalone would be a smaller image, but this app
# reaches runtime code the tracer does not follow reliably — nodemailer is
# already declared in serverExternalPackages, and the Prisma driver adapter
# loads mariadb through the same kind of indirection. Correctness over MBs.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
 # --ignore-scripts above also skips @prisma/engines' postinstall, which is what
 # downloads the schema engine binary. Nothing at *runtime* needs it — queries
 # go through the mariadb driver adapter — but `prisma migrate` does, and
 # without this the CLI is unusable inside the container. Rebuilding just this
 # one package fetches the Linux engine while still skipping the rest (notably
 # better-sqlite3, which has no musl prebuild and would compile from source).
 && npm rebuild @prisma/engines \
 && npm cache clean --force

# --chown because the container drops to the unprivileged `node` user below,
# and `next start` writes into .next/cache (the on-disk image-optimizer cache).
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/lib/generated ./lib/generated
COPY --from=builder --chown=node:node /app/next.config.mjs ./next.config.mjs

# Carried so `prisma migrate deploy` can be run against a deployed container.
# The prisma CLI is a regular dependency, so it survives --omit=dev, and the
# rebuild above gives it the engine it needs. prisma.config.ts imports
# dotenv/config, which finds no .env here and is a no-op — DATABASE_URL comes
# from the container environment instead.
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts

# Railway injects its own PORT at runtime, which overrides this; the default is
# what plain `docker run` and compose get. `next start` reads both.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

USER node

CMD ["npm", "run", "start"]
