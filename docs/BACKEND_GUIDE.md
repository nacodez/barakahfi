# Backend guide

A tour of the BarakahFi backend for someone coming from the frontend. Read it with the code open.

## 1. Look at your data

Everything runs locally in Docker (`pnpm db:up`). Neon is only needed once you deploy.

**Visual viewer (easiest):**

```bash
pnpm --filter @barakahfi/api db:studio
```

It prints a local URL. Click a table, see rows, edit them.

**SQL shell:**

```bash
docker compose exec postgres psql -U barakahfi -d barakahfi
```

Useful commands inside it: `\dt` (tables), `\d accounts` (columns, indexes, foreign keys), `\q` (quit).

**GUI client** (TablePlus, DBeaver, VS Code SQL extension), local dev credentials only:

```
postgresql://barakahfi:barakahfi@localhost:5434/barakahfi
```

Queries worth running:

```sql
-- the 15 system categories from the seed script
select name, type, halal_status from categories order by type, name;

-- one-to-many: how many accounts each user has
select u.email, count(a.id) as accounts
from users u left join accounts a on a.user_id = u.id
group by u.email;

-- refresh-token families: login sessions, and whether theft was detected
select family_id, count(*) as tokens, bool_or(revoked_at is not null) as revoked
from refresh_tokens group by family_id;

-- why indexes exist: compare the plan with and without the index on user_id
explain analyze select * from accounts where user_id = '<paste a user id>' and archived_at is null;
```

## 2. Call the API yourself

The frontend is only one client. Try it with curl (`-c`/`-b` store and send cookies):

```bash
curl -c jar.txt -X POST localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"YourPassword1"}'
curl -b jar.txt localhost:4000/api/v1/accounts
```

Run `pnpm dev` first. Without the cookie file the second call returns 401.

## 3. Map of `apps/api/src`

| Folder                 | Job                                                                          |
| ---------------------- | ---------------------------------------------------------------------------- |
| `main.ts`              | Starts the server                                                            |
| `app.setup.ts`         | Middleware and pipeline: security headers, cookies, CSRF check, validation   |
| `app.module.ts`        | Wires modules together and registers the global guards                       |
| `config/env.ts`        | Validates environment variables at startup; the app refuses to boot if wrong |
| `auth/`                | Register, login, refresh, logout, JWT guard, roles guard                     |
| `users/`, `accounts/`  | Feature modules: controller, service, DTOs                                   |
| `categories/`          | System and custom categories, each with a halal status                       |
| `transactions/`        | The ledger: every change also updates account balances, atomically           |
| `budgets/`             | Limits per category; spend is calculated live from transactions              |
| `reports/`             | Aggregations for charts (monthly income vs expenses)                         |
| `swagger.ts`           | Interactive API docs at `/api/docs`                                          |
| `market/`              | Live prices (swappable provider), exchange rates, gold and silver prices     |
| `screener/`            | The AAOIFI screening engine, the 24-hour cache, and stock search             |
| `portfolio/`           | Holdings, valuation, allocation and purification due                         |
| `zakat/`               | The zakat calculator, Hijri year and hawl helpers, saved records             |
| `realtime/`            | WebSocket gateway, one-time tickets, price ticker, market hours, alert bus   |
| `prisma/`              | Database client wrapper                                                      |
| `common/`              | Error filter, response envelope, request logging                             |
| `prisma/schema.prisma` | The database schema; the source of truth                                     |

Every feature follows the same layers:

```
Controller  (HTTP: routes, status codes, reads the request)
   -> Service  (business rules: this is where logic lives)
      -> Prisma  (talks to Postgres)
```

DTO classes (`dto/*.ts`) describe and validate what clients may send.

## 4. Life of a request: `POST /api/v1/auth/login`

1. The browser calls `/api/v1/auth/login` on the Next.js server, which forwards it to NestJS (`apps/web/next.config.ts`).
2. `app.setup.ts` middleware runs: Helmet headers, cookie parser, Origin check.
3. Guards run: rate limiter (5 attempts a minute for login), then the JWT guard (skipped because the route is `@Public()`).
4. `ValidationPipe` checks the body against `LoginDto`. Unknown fields are rejected.
5. `AuthController.login` calls `AuthService.login`:
   - finds the user by email;
   - verifies the password with argon2 (even for unknown emails, so timing doesn't leak which accounts exist);
   - `TokenService` signs a 15-minute JWT and creates a refresh token (only its hash is stored).
6. The controller sets two httpOnly cookies. JavaScript in the browser can never read them.
7. `ResponseEnvelopeInterceptor` wraps the result as `{ data, meta, error }`. If anything threw, `AllExceptionsFilter` builds the error version instead.
8. `LoggingInterceptor` logs method, path, status and duration as JSON.

## 5. Database ideas used here

- **UUID primary keys:** ids can't be guessed or counted.
- **Foreign keys with `onDelete: Cascade`:** deleting a user removes their accounts and tokens.
- **Indexes:** `accounts(user_id, archived_at)` makes "my active accounts" fast; look at the others with `\d`.
- **`Decimal(15,2)` for money, strings in JSON:** floats can't represent 0.1 exactly. The web app sums in integer cents.
- **Soft delete (`archived_at`):** archiving keeps history; a hard delete would break future transaction records.
- **Migrations (`prisma/migrations`):** versioned SQL files. `prisma migrate dev` creates them, `prisma migrate deploy` applies them in production. Never edit the database by hand and forget the migration.
- **Seed (`prisma/seed.ts`):** repeatable starter data.
- **DB transactions (`$transaction`):** a group of writes that all succeed or all roll back. Used when rotating refresh tokens, and in `transactions.service.ts`: creating, editing or deleting a ledger entry changes the account balance in the same DB transaction, so the two can never disagree.
- **Atomic increments:** balances change with `balance = balance + x` in SQL (Prisma `increment`), not read-modify-write in code, so ten simultaneous expenses still add up exactly. A test fires ten at once.
- **Row locking:** editing a transaction first updates its row, which locks it until the DB transaction ends, so two simultaneous edits queue up instead of both reversing the same old amount.
- **Cursor pagination:** the transaction list returns a `nextCursor` (the last id) instead of page numbers, so infinite scroll stays correct while new rows arrive.
- **Aggregation in SQL:** `reports/reports.service.ts` groups by month in Postgres (`date_trunc`) instead of loading rows into Node. Budgets use Prisma's `aggregate`.

## 5b. Phase 3 ideas worth understanding

- **Pure logic, tested alone:** the screening rules (`screener/screening.engine.ts`), zakat maths (`zakat/zakat.calc.ts`) and market hours (`realtime/market-hours.ts`) are plain functions with no database or framework in them. That is why they have dozens of tiny tests that run in milliseconds.
- **Swappable data sources:** `PriceProvider` and `FinancialDataProvider` are abstract classes. The app depends on the abstraction, so replacing Yahoo with a paid feed, or the sample screening data with Musaffa, is one new class. Tests inject fakes the same way.
- **Latest row per group in SQL:** the screener search uses `DISTINCT ON (asset_id) ... ORDER BY asset_id, screened_at DESC` to get each stock's newest verdict, served by the `(asset_id, screened_at DESC)` index, with `COUNT(*) OVER()` giving the total in the same query.
- **Compare-and-set to avoid duplicate work:** when a stored screening is over 24 hours old, `UPDATE ... WHERE id = ? AND screened_at = <old value>` lets exactly one of several simultaneous requests perform the re-check. A test fires six at once.
- **Never trust the browser's numbers:** the zakat endpoints receive only ids and the user's own manual inputs; account and holding values are read from the database again. Saved records keep the full breakdown so a past figure can always be explained.
- **WebSocket auth without cookies:** in production the web app and API are on different sites, so the login cookie never reaches the socket handshake. The signed-in client asks `POST /realtime/ticket` (which does carry the cookie) for a 60-second pass signed with a different key, and presents that when connecting. Each user joins a private room, so nobody receives anyone else's data.
- **Fetch only what is needed:** the price ticker looks up only the stocks held by users who are connected right now, on exchanges that are open, and skips a cycle if the previous one is still running.

## 6. Security checklist (what is implemented)

- Passwords hashed with argon2id, never stored or logged.
- Short-lived access JWT plus one-time refresh tokens; replaying an old one revokes the whole session family.
- httpOnly + SameSite cookies, Origin check against CSRF, Helmet headers.
- Rate limiting on every route, stricter on login.
- Input validation on every endpoint; unknown fields rejected.
- Users can only reach their own rows (ownership is part of every query; others get 404).
- Secrets only in environment variables; `.env` is gitignored.

## 7. Azure and Neon: how the pieces map

This app is cloud-neutral. If a job uses Azure, these are the equivalents:

| This project                 | Azure equivalent                              |
| ---------------------------- | --------------------------------------------- |
| Render (runs the NestJS API) | Azure App Service or Azure Container Apps     |
| Neon / Docker Postgres       | Azure Database for PostgreSQL (or Azure SQL)  |
| `.env` and Render env vars   | Azure Key Vault and App Service configuration |
| GitHub Actions CI            | GitHub Actions or Azure DevOps Pipelines      |
| JSON request logs, Sentry    | Application Insights                          |
| Our own JWT auth             | Microsoft Entra ID (formerly Azure AD)        |
| Redis container              | Azure Cache for Redis                         |
| Cloudflare R2 (future files) | Azure Blob Storage                            |

The concepts transfer one to one: a container or app service, a managed Postgres, secrets outside the code, a pipeline, structured logs. Learning them here means Azure is mostly new names.

## 8. What recruiters tend to look for, and where this repo shows it

| Signal                         | Where                                                                        | Still to add                                          |
| ------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| Clean layered architecture     | Modules in `auth/`, `users/`, `accounts/`, `transactions/`, `budgets/`       |                                                       |
| Real auth, done safely         | `auth/`, `test/auth.e2e-spec.ts`                                             | Google sign-in, email verification                    |
| Database design and migrations | `schema.prisma`, `prisma/migrations`                                         | Portfolio, screening and zakat tables (Phase 3)       |
| Tests at several levels        | Unit specs, e2e specs against a real DB                                      | Coverage report in CI                                 |
| CI pipeline                    | `.github/workflows/ci.yml`                                                   | Deploy step                                           |
| Docker                         | `docker-compose.yml` (DB, Redis)                                             | A Dockerfile for the API                              |
| API documentation              | `/api/docs` (OpenAPI), generated from the validation decorators              | A hosted demo link in the README                      |
| Observability                  | JSON request logs, `/health`                                                 | Sentry or Application Insights                        |
| Pagination, caching, queues    | Cursor pagination on transactions                                            | Redis cache, background jobs (recurring transactions) |
| Real-time features             | `realtime/` (Socket.IO, ticket auth, rooms), `use-websocket.ts` with backoff | Redis adapter for multiple API instances              |
| Third-party integration        | `market/` behind swappable providers, graceful fallbacks                     | A licensed screening data provider                    |
| Domain logic done carefully    | `screener/`, `zakat/` with edge-case tests                                   | Scholar review of the rules                           |

## 9. Suggested reading order

1. `prisma/schema.prisma`, to see the data.
2. `src/main.ts`, `src/app.setup.ts`, `src/app.module.ts`, to see how the app starts and what runs on every request.
3. `src/accounts/` (controller, service, DTO), the simplest complete feature.
4. `src/auth/auth.service.ts` and `token.service.ts`, the most interesting logic.
5. `test/auth.e2e-spec.ts`, to see how behaviour is proven.
