# Production readiness: decisions and gaps

This is an honest account of what the API does today to be safe to run, what was added
for caching and deployment, and what is still missing before real users and real money.

## What was added, and why

### 1. Redis cache for FX rates and gold/silver prices

**Problem.** Prices come from Yahoo Finance, which is slow and rate-limited. The old code kept
them in a per-process `Map`. That is lost on every restart and is not shared if more than
one API instance runs, so each instance would call the provider separately.

**Decision.** `CacheService` (`apps/api/src/cache/`) stores JSON values in Redis when
`REDIS_URL` is set, and in memory when it is not.

| Choice                                            | Why                                                                                           | Cost                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Redis as a shared cache                           | All API instances see one entry; survives restarts                                            | One more service to run                                                                    |
| Cache is optional, never a dependency             | Redis down must not take the API down                                                         | Two code paths to test                                                                     |
| Every write also goes to memory                   | During a Redis outage the app falls back to the old per-instance behaviour instead of failing | Slightly more memory, and instances may briefly disagree during an outage                  |
| Freshness is decided by a stored timestamp (`at`) | The same entry is "fresh" for 10 min (metals) / 1 h (FX) and still usable as a stale fallback | Redis key lives 24 h, so a stale price can be served for up to a day if the provider fails |
| Result is flagged `source: "cached"` when stale   | The UI can tell the user the price is not live                                                | Callers must handle the flag                                                               |

**If Redis is down:** reads and writes swallow the error, use the in-memory copy, and the
provider is called as before. `enableOfflineQueue: false` makes commands fail immediately
instead of piling up while Redis is unreachable.

**Not done on purpose.** Screener results and user data are not cached. They change per
user, and caching them needs invalidation rules that are easy to get wrong.

### 2. `/health` reports Redis

The database is required: if it is down the endpoint returns 503. Redis is only a cache, so
if it is down the endpoint returns 200 with `status: "degraded"` and `redis: "down"`.
Returning 503 for a cache outage would make an orchestrator restart a healthy API.

Possible values: `redis: "up" | "down" | "disabled"` (disabled means `REDIS_URL` is unset).

### 3. Dockerfile for the API (`apps/api/Dockerfile`)

Multi-stage build, run from the repo root because the API depends on `packages/shared`:

- **build**: installs everything, generates the Prisma client, compiles shared + API.
- **prod-deps**: `pnpm deploy --prod` copies only the API and its production dependencies.
- **migrate**: the build stage, which has the Prisma CLI, used as a one-off release step
  (`pnpm --filter @barakahfi/api db:deploy`). Migrations are not run on container start,
  so several instances starting at once cannot race each other.
- **runtime**: production dependencies + compiled output, runs as the non-root `node`
  user, has a `HEALTHCHECK` on `/api/v1/health`.

The image is 605 MB (it was 2.47 GB before switching the runtime stage to `pnpm deploy`).
Verified by running it against the local Postgres and Redis: `/health` returns `ok`, then
`degraded` when Redis is stopped, and registering a user works (this exercises the native
`argon2` module inside Alpine).

## What is already in place

- Global input validation (`whitelist`, `forbidNonWhitelisted`) and environment validation
  at boot (Zod).
- JWT access and refresh tokens in `httpOnly` cookies, refresh-token reuse detection,
  `helmet`, CORS restricted to the web origin, an Origin check against CSRF.
- Rate limiting (100 requests per minute per IP, tighter on auth routes).
- Balance changes only inside `prisma.$transaction`, composite indexes, cursor pagination
  on transactions.
- Unit and e2e tests, and CI that runs format, lint, typecheck, migrations, tests and build.

## What is still missing (what I would do before production)

| Gap                                                                                               | What I would do                                                                              |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| No Dockerfile for the web app                                                                     | Add one using Next.js standalone output                                                      |
| Logging is NestJS's default text logger                                                           | Structured JSON logs (for example `pino`) with a request id                                  |
| No error tracking or metrics                                                                      | Sentry for errors; Prometheus or OpenTelemetry for latency and error rates                   |
| No backups or restore test                                                                        | Managed Postgres with point-in-time recovery, and a tested restore                           |
| Screening data is placeholder; README says so                                                     | Replace the data source with a licensed provider behind the existing `FinancialDataProvider` |
| JWT secrets in `.env.example` are placeholders                                                    | Real secrets from a secret manager, rotated                                                  |
| Only transactions are paginated (other list endpoints not audited)                                | Audit and paginate every list endpoint                                                       |
| No load testing                                                                                   | Run k6 or autocannon against key endpoints to find real limits                               |
| Rate limiter state is per process                                                                 | Back the throttler with Redis so limits hold across instances                                |
| Redis cache has no stampede protection (many requests can hit the provider when an entry expires) | Add a short lock or request coalescing around the provider call                              |
| The CI database is built without Redis, so the Redis path is only tested manually                 | Add a Redis service to CI and an integration test                                            |
