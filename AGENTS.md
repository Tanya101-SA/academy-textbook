# AGENTS.md — Textbooks / Textbook Mapping

Instructions for AI coding agents and human contributors.

## Canonical project root (source of truth)

The authoritative **SpecCon Academy — Textbooks** workspace (indexes, spreadsheets, screenshots, and the full web app with `src/` and `package.json`) lives here:

`C:\Users\theoc\OneDrive - Speccon Holdings (Pty) Ltd\SpecCon Academy - Textbooks`

| Location | Contents |
|----------|----------|
| Root | `PROJECT_MAP.md` (structure, publishers, schema summary, UI map), Excel/PDF assets, dashboard screenshots |
| `Indexes (English Textbooks)/`, `Indexes (Afrikaans Textbooks)/` | Per-publisher TXT indexes (~98 books) |
| `Spreadsheets/` | Academy vs lesson topic mappings, contributor sheets |
| `Vecel App/textbook-mapping/` | **Node/TypeScript app** — treat as the primary codebase |

If a copy of the app under another path is **missing `src/` or `package.json`**, sync from this folder before implementing features.

## Purpose

Catalogue South African CAPS textbooks across publishers, map textbook topics to SpecCon Academy **system topics**, surface **missing** textbook topics, and provide an authenticated admin UI. See **`PROJECT_MAP.md`** in the canonical folder for publisher matrices, grade coverage, and file inventory.

## Application stack — `Vecel App/textbook-mapping/`

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript, Vite 6, Tailwind, React Router 7 |
| Local API | Express (`npm run dev:server` → `tsx watch src/server/index.ts`) |
| Production API | Vercel serverless handlers in `api/**/*.ts` (`@vercel/node`) |
| Database | PostgreSQL via Drizzle ORM; runtime driver includes `@neondatabase/serverless` |
| Auth | JWT (`api/_auth.ts` / server equivalent), bcrypt for passwords |

`vercel.json` builds the Vite client to `dist/client` and rewrites SPA routes; `/api/*` is served by the `api/` functions.

## Useful npm scripts

```bash
npm run dev              # Express API + Vite client (concurrently)
npm run build            # Vite production client build
npm run db:push          # drizzle-kit push
npm run db:studio        # Drizzle Studio
npm run import           # Excel import scripts (see package.json)
```

## API surface (Vercel `api/`)

- `api/auth/login.ts`, `api/auth/me.ts`
- `api/users/index.ts`
- `api/topics/index.ts`, `api/topics/detail.ts`, `api/topics/subjects.ts`
- `api/publishers/index.ts`
- `api/mappings/index.ts`, `api/mappings/detail.ts`
- `api/missing-topics/index.ts`, `api/missing-topics/detail.ts`
- `api/stats/index.ts`

Handlers: verify JWT where required, validate input, use Drizzle; return safe `500` messages.

## Conventions

- **ESM** (`"type": "module"`). Vercel handlers use **`.js` extensions** in relative imports (e.g. `'../_auth.js'`, `'../../src/db/index.js'`).
- **Secrets**: `JWT_SECRET` and DB URL from environment only in production; never commit `.env`.
- **Immutability** and **validated inputs** per team rules.

## Environment variables

Set in Vercel and local `.env` (exact names live in `src/db/` and server bootstrap — typically database URL and `JWT_SECRET`).

## Other copies / mirrors

Partial checkouts (e.g. only `api/` + `dist/`) are **not** a complete app. Require `package.json`, `vite.config.ts`, `src/server/`, `src/client/`, and `src/db/` before treating a tree as authoritative.

## What agents should do first

1. Open the **canonical OneDrive path** (or confirm the workspace copy matches it).
2. Read **`PROJECT_MAP.md`** for domain context.
3. For code changes: identify whether the task touches **Express** (`src/server/`), **Vercel** (`api/`), **client** (`src/client/`), or **schema** (`src/db/schema.ts`) — keep layers consistent.
4. Run `npm run dev` or `npm run build` after changes when possible.

---

*Canonical root: `SpecCon Academy - Textbooks` on OneDrive (Speccon Holdings).*
