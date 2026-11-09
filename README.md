# BarakahFi

Sharia-compliant personal finance platform: portfolio tracking, halal stock screening, zakat, budgets.

Turborepo · Next.js 16 · NestJS 12 · PostgreSQL 18 + Prisma 7 · TypeScript 6 (strict)

## What it does

- **Accounts, transactions, budgets and reports** with balances that stay exact (atomic updates).
- **Portfolio** with live prices, gain/loss, allocation and the dividend **purification** owed per holding.
- **Halal stock screener** applying the AAOIFI business and financial-ratio screens, with a plain-English breakdown of every check.
- **Zakat calculator**: a four-step wizard using your own balances and today's gold and silver prices, with saved history and payment tracking.
- Works on phones: responsive layouts, a bottom tab bar, and "Add to Home Screen" support.

> **Sample data.** The screening ratios and verdicts shipped with the demo are illustrative placeholders, not real Sharia screening results (prices are real). They are labelled as such throughout the UI. A production deployment should replace the data source with a licensed provider such as Musaffa, Zoya or IdealRatings; the app only depends on the `FinancialDataProvider` interface for this.

## Layout

```
apps/web         Next.js 16 App Router (UI, Server Components)
apps/api         NestJS 12 REST API (/api/v1), Prisma, auth
packages/shared  Types, enums, Zod schemas and limits shared by web + api
packages/tsconfig Base TS config
```

## Getting started

```bash
pnpm install
pnpm db:up                                   # Postgres :5434, Redis :6380
cp apps/api/.env.example apps/api/.env       # already done locally
pnpm --filter @barakahfi/api db:migrate      # create tables
pnpm --filter @barakahfi/api db:seed         # system categories
pnpm dev                                     # web :3000, api :4000
curl localhost:4000/api/v1/health
```

Interactive API docs: http://localhost:4000/api/docs

## Architecture decisions

| Decision                                           | Why                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NestJS owns auth** (not Auth.js)                 | One token issuer. Access JWT 15 min + rotating refresh token 7 d in httpOnly cookies; refresh-token families detect replay. Next.js middleware only checks the session. Auth.js v5 is still beta.                                                                   |
| **Money as `Decimal(15,2)` + strings on the wire** | No IEEE-754 float rounding. Balances only change inside `prisma.$transaction`.                                                                                                                                                                                      |
| **Postgres: Docker locally, Neon in production**   | Plain Postgres everywhere (no vendor lock-in). Neon gives database branching per PR for preview deploys, plus pooled vs direct URLs (`DATABASE_URL` / `DIRECT_DATABASE_URL`). Supabase's main features (Auth, RLS, Realtime) overlap with what NestJS already does. |
| **Vitest + `unplugin-swc`**                        | esbuild doesn't emit decorator metadata; Nest DI needs it.                                                                                                                                                                                                          |
| **Response envelope `{ data, meta, error }`**      | Enforced globally by `ResponseEnvelopeInterceptor` + `AllExceptionsFilter`.                                                                                                                                                                                         |

## Production integration points

Musaffa / IdealRatings / Zoya for screening data (the demo uses a seeded dataset plus Alpha Vantage prices).
