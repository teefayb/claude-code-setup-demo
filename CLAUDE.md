# Teamlinks

Shared bookmarks app. Next.js 16 App Router + TypeScript, Zod validation, a JSON-file
data layer, Vitest. No database, no auth (internal tool behind the company VPN).

## Commands

- `npm run dev` — local server on :3000 (writes to `data/links.local.json`, gitignored)
- `npm test` — Vitest, runs in ~1s. Run a single file: `npx vitest run src/lib/links/store.test.ts`
- `npm run typecheck` / `npm run lint` / `npm run format:check`
- `npm run check` — all of the above; run it before saying a task is done
- `npm run build` — production build; run after touching routes, layouts or config

## Layout

- `src/app/` — pages and route handlers (`src/app/api/**/route.ts`)
- `src/lib/links/schema.ts` — Zod schemas; the single source of truth for the `Link` shape
- `src/lib/links/store.ts` — the only module that touches the data file
- `src/lib/http.ts` — `errorResponse` / `validationError`; every API error goes through these
- `src/components/` — client components (`"use client"`), no data access
- `src/test/` — test helpers; `useTempDataFile()` isolates each test's data file
- `data/seed.json` — seed data; the app reads it when no data file exists

## Conventions

- Validate every request body with a Zod schema from `schema.ts`; never trust `request.json()`.
- API errors are `{ error: "snake_case_code", details? }` with the right status (400/404/500).
- Next 16: route `params` and page `searchParams` are Promises — `await` them.
- Tests sit next to the code (`foo.ts` → `foo.test.ts`). Route tests call the exported
  handlers with a `Request`; no HTTP server.
- Data files already exist in the wild. A breaking change to the stored shape bumps `version`
  and upgrades old files on read in `store.ts`; update `seed.json` too (see `/change-data-model`).
- A hook runs Prettier + `eslint --fix` after every edit; fix any lint errors it reports.

## Never

- Read or write `.env*` files (except `.env.example`), or paste secrets into code, tests or docs.
- Force-push, push to `main`, or run `git reset --hard` / `git clean`. Work on a branch and open a PR.
- Run deploy commands (`vercel`, `netlify`, `fly`, `npm publish`) — CI/CD deploys.
- Commit `data/links.local.json` or edit `data/seed.json` to make a test pass.

## Team workflows

Skills: `/add-api-route`, `/change-data-model`, `/triage-test`, `/pr-description`, `/review`.
Subagents: `code-reviewer`, `test-writer`, `docs-writer`. See `docs/team-playbook.md`.
