# Claude Code setup for dev teams: demo repo

This repo shows what you get when you buy a **Claude Code team setup**. It is a small,
realistic Next.js app with the **Premium** package applied, so you can see every file,
read every rule, and check that it works before you order.

> Built by **@teefayb**. Order on Fiverr, Upwork or Contra (links in the profile).

---

## The app (the vehicle, not the product)

**Teamlinks** is a shared bookmarks app for a dev team: add a link with tags, filter by tag,
delete. Small on purpose, but built the way real team projects are:

- Next.js 16 (App Router) + TypeScript (strict)
- REST API: `GET/POST /api/links`, `DELETE /api/links/[id]`, Zod validation, consistent errors
- JSON-file data layer with atomic writes and a versioned file format
- Vitest tests, ESLint + Prettier, GitHub Actions CI

```bash
npm ci
npm run dev      # http://localhost:3000
npm run check    # typecheck + lint + format check + tests
npm run build
```

## Before and after

The git history is the before/after. Each tier is one commit, tagged:

```bash
git log --oneline                # app → basic → standard → premium
git diff before basic --stat     # what the Basic package adds
git diff before premium --stat   # everything in Premium
```

|                                      | Before (plain repo)                                            | After (Premium setup)                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude's first answer about the repo | Reads files and guesses the commands and patterns              | Knows the commands, layout and conventions from `CLAUDE.md`                                                                                        |
| Running tests and lint               | A permission prompt every time                                 | Runs without prompts; push and installs still ask                                                                                                  |
| Secrets                              | Nothing stops Claude reading `.env` or pasting a key into code | `.env*` and key files are unreadable; writes containing keys are blocked                                                                           |
| Destructive commands                 | Allowed after one click                                        | Force push, push to `main`, `reset --hard`, `rm -rf`, deploys are denied; a hook catches force pushes hidden in `sh -c`, `eval`, `git -C`, scripts |
| Formatting                           | Claude writes code; you run Prettier and fix lint              | A hook formats each edit and sends lint errors back to Claude                                                                                      |
| Adding an endpoint                   | Long prompt explaining the patterns, every time                | `/add-api-route PATCH /api/links/[id] ...`                                                                                                         |
| Code review                          | Ad hoc                                                         | `/review` locally, plus Claude review on every PR in CI                                                                                            |
| Onboarding a new dev                 | "Ask around"                                                   | `docs/team-playbook.md`                                                                                                                            |

## What's in each tier

| File                                        | What it does                                                                                                                                 | Basic | Standard | Premium |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | :---: | :------: | :-----: |
| `CLAUDE.md`                                 | Commands, architecture, conventions and "never do" list for this repo                                                                        |   ✓   |    ✓     |    ✓    |
| `.claude/settings.json` → `permissions`     | Allow test/lint/build/typecheck; ask before push, installs, workflow edits; deny secret reads, destructive git, deploys, prod DB             |   ✓   |    ✓     |    ✓    |
| `.gitignore` additions                      | Keep personal Claude files (`settings.local.json`, `CLAUDE.local.md`) out of git                                                             |   ✓   |    ✓     |    ✓    |
| README "Using Claude Code" section          | How the team starts using it                                                                                                                 |   ✓   |    ✓     |    ✓    |
| `.claude/skills/add-api-route/`             | `/add-api-route`: route + Zod schema + tests, in house style                                                                                 |       |    ✓     |    ✓    |
| `.claude/skills/change-data-model/`         | `/change-data-model`: safe field changes with versioned upgrade of stored data                                                               |       |    ✓     |    ✓    |
| `.claude/skills/triage-test/`               | `/triage-test`: reproduce, classify, fix a failing test or CI run                                                                            |       |    ✓     |    ✓    |
| `.claude/skills/pr-description/`            | `/pr-description`: PR text from the real diff, in the team template                                                                          |       |    ✓     |    ✓    |
| `.claude/hooks/guard-secrets.mjs` (+ test)  | PreToolUse hook: blocks `.env*`/key files and credential-looking content                                                                     |       |    ✓     |    ✓    |
| `.claude/hooks/format-on-edit.mjs`          | PostToolUse hook: Prettier + `eslint --fix` on each edit; reports leftover errors to Claude                                                  |       |    ✓     |    ✓    |
| `.claude/settings.json` → `hooks`           | Wires up the two hooks                                                                                                                       |       |    ✓     |    ✓    |
| `.mcp.json`                                 | Playwright MCP: Claude drives the running app in a headless browser                                                                          |       |    ✓     |    ✓    |
| `.claude/agents/code-reviewer.md`           | Read-only reviewer subagent with this repo's review checklist                                                                                |       |          |    ✓    |
| `.claude/agents/test-writer.md`             | Writes Vitest tests in the repo's patterns                                                                                                   |       |          |    ✓    |
| `.claude/agents/docs-writer.md`             | Keeps README/docs in step with the code                                                                                                      |       |          |    ✓    |
| `.claude/hooks/guard-git-push.mjs` (+ test) | PreToolUse hook: blocks force pushes and pushes to `main`/`master`/`production`, including chained, wrapped, `sh -c`/`eval` and script forms |       |          |    ✓    |
| `.claude/skills/review/`                    | `/review`: local pre-PR review using the subagents + `npm run check`                                                                         |       |          |    ✓    |
| `.github/workflows/claude-review.yml`       | Claude reviews every non-draft PR with inline comments                                                                                       |       |          |    ✓    |
| `docs/team-playbook.md`                     | Setup, daily workflows, review flow, guardrails and their limits, troubleshooting                                                            |       |          |    ✓    |

On your repo, skills, hooks and subagents are written for **your** stack and the workflows
you name in the order form. The ones here are examples of the depth you get.

## Using Claude Code in this repo (day one)

1. `npm ci`, then run `claude` in the repo root. Accept the workspace-trust prompt (the shared
   allow rules only apply after that) and approve the `playwright` MCP server.
2. Ask anything about the code. Claude already knows how to run, test and structure it.
3. Use the skills:

   ```text
   /add-api-route PATCH /api/links/[id] to edit a link's title and tags
   /triage-test src/lib/links/store.test.ts
   /review
   /pr-description
   ```

4. Use the subagents by name: "use the test-writer subagent to cover the DELETE route".
5. Read `docs/team-playbook.md` once. It covers the review flow and what Claude is and
   isn't allowed to do here.

## How it was verified

| Check                                                                                | Result                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` (typecheck, lint, format, 105 tests incl. hook tests)                | Pass                                                                                                                                                                                                                                                                            |
| `npm run build`                                                                      | Pass, no warnings                                                                                                                                                                                                                                                               |
| `.claude/settings.json` against the published settings JSON schema                   | Valid                                                                                                                                                                                                                                                                           |
| Live Claude Code session, headless (`claude -p`, project settings only)              | Write with an AWS-format key: **blocked by hook**. Write `.env.production`: **blocked by hook**. Read `.env`: **denied**. `git push --force origin main`: **denied**. `git reset --hard`: **denied**. Messy code written: **auto-formatted**. Read `.env.example`: allowed      |
| 22 + 1 ways to force-push or push to `main` ([results](docs/bypass-test-results.md)) | Deny rules alone: 7 hard-blocked, 15 fell through to a permission prompt. Rules + `guard-git-push` hook: all 22 original variants plus a reader-reported 23rd (push refspecs in git config) blocked; explicit feature-branch pushes (`git push origin my-branch`) still allowed |
| Skills and subagents discovered by Claude Code                                       | All 5 skills, all 3 subagents                                                                                                                                                                                                                                                   |
| Playwright MCP server                                                                | Starts and lists its tools over stdio                                                                                                                                                                                                                                           |
| GitHub Actions workflows                                                             | Valid YAML; not run (no remote)                                                                                                                                                                                                                                                 |

## Guardrail limits (read this)

Permission rules match commands as Claude writes them. They are a strong default, not a
sandbox: a workaround like `bash -c '...'` isn't matched by a rule. The `guard-git-push` hook
reads the full command (including `sh -c`, `eval` and local scripts) and closes that gap for
pushes, but it still only sees commands Claude runs through the Bash tool. Pair this setup with
branch protection on `main`, deploy credentials that never sit on developer machines, and
GitHub secret scanning. For OS-level isolation, enable Claude Code's sandbox (`/sandbox`).

## Order your setup

1. Pick a tier. Basic gets you a safe, repo-aware Claude. Standard adds your workflows,
   hooks and one integration. Premium adds subagents, a review workflow and a team playbook.
2. Answer the intake questions: stack, repo access, the 3–5 workflows you repeat most,
   and anything that must never be touched.
3. You get a branch or PR with the files above, written for your repo, plus a handover note
   listing what was verified.

No secrets are ever needed: anything that needs a key is documented with the variable name,
and you put the value in your own secret manager.
