# MOTORNA

Car marketplace for Egypt — Arabic-first (RTL) with English, EGP pricing, launching in Alexandria.

**Status:** Phase 1 (functional marketplace MVP) complete. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full plan and [docs/PHASE-1.md](docs/PHASE-1.md) for what was built, tested, and what's left.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM · Better Auth · sharp

## Run locally

Requirements: Node 22+, PostgreSQL 14+.

```bash
npm install
cp .env.example .env.local          # set DATABASE_URL and BETTER_AUTH_SECRET
npm run db:migrate                  # create tables
npm run db:seed:reference           # governorates + makes/models (safe in any env)
npm run db:seed:demo                # DEV ONLY: demo users, listings, placeholder photos
npm run dev                         # http://localhost:3000 → /ar
```

Demo accounts (after `db:seed:demo`): `admin@example.com`, `karim@example.com`, `nour@example.com`, `omar@example.com` — password `motorna-demo-2026`.

In development, password-reset emails are printed to the server console.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit + integration tests (needs a local `motorna_test` database) |
| `npm run db:generate` | New migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `node tests/e2e/smoke.mjs` | End-to-end UI smoke test (needs a running app, demo seed, Chrome via `CHROME_PATH`) |

## Project layout

```
src/app/[lang]/        pages (ar/en)
src/app/api/           auth + image upload
src/components/        UI (ui/ = design system primitives)
src/server/            data access, server actions, rate limiting, audit
src/lib/               validation, formatting, storage, images, search params
src/db/                schema + reference data
src/i18n/              locale config + dictionaries
drizzle/               SQL migrations
scripts/               seeds
tests/                 vitest + e2e
```
