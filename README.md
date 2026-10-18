# Teamlinks

Shared bookmarks for the team: add a link with tags, filter by tag, delete.

## Develop

```bash
npm ci
npm run dev      # http://localhost:3000
npm run check    # typecheck + lint + format check + tests
npm run build
```

Data is stored in `data/links.local.json` (gitignored). Set `LINKS_DATA_FILE` to use
another path. When the file doesn't exist, the app starts from `data/seed.json`.

## API

- `GET /api/links?tag=ops` → `{ links: Link[] }`
- `POST /api/links` `{ title, url, tags? }` → `201 { link }` · `400 { error, details? }`
- `DELETE /api/links/:id` → `204` · `404 { error: "not_found" }`

## Using Claude Code

This repo ships a shared Claude Code setup:

- `CLAUDE.md` — how to build, test and structure code here. Claude reads it every session.
- `.claude/settings.json` — tests, lint, typecheck and build run without prompts; push and
  installs ask first; `.env*` and key files can't be read; force push, push to `main`,
  `reset --hard`, `rm -rf` and deploy commands are blocked.

- Skills: `/add-api-route`, `/change-data-model`, `/triage-test`, `/pr-description`.
- Hooks: a secret guard blocks writing `.env*`, key files or credential-looking content;
  every edit is run through Prettier and `eslint --fix`.
- MCP: `playwright` lets Claude open the running app and click through it. Approve it on
  first run; run `npx playwright install chromium` if the browser is missing.

Start `claude` in the repo root and accept the workspace-trust prompt once (shared allow
rules apply only after that). Personal tweaks go in `.claude/settings.local.json` or
`CLAUDE.local.md`, both gitignored.
