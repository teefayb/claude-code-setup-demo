# Team playbook: working with Claude Code in Teamlinks

This is how our team uses Claude Code in this repo. Read it once. The short version is in
`CLAUDE.md`, which Claude reads at the start of every session.

## 1. First-time setup (10 minutes)

1. Install Claude Code and sign in (`claude` in a terminal).
2. Clone the repo, run `npm ci`, then start `claude` from the repo root.
3. Accept the **workspace trust** prompt. Until you do, the shared `allow` rules are ignored
   and you'll get extra permission prompts. `deny` and `ask` rules apply either way.
4. Approve the **playwright** MCP server when asked. The first browser run downloads
   Chromium; if it fails, run `npx playwright install chromium` once.
5. Personal preferences go in `.claude/settings.local.json` or `CLAUDE.local.md`. Both are
   gitignored. Never add team rules there.

## 2. What is configured, and why

| Piece             | File                                    | What it does                                                                                                                       |
| ----------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Project memory    | `CLAUDE.md`                             | Commands, layout, conventions and "never" list for this repo                                                                       |
| Permissions       | `.claude/settings.json` → `permissions` | Allows test/lint/build without prompts; asks before push, installs and workflow edits; denies secrets, destructive git and deploys |
| Push guard hook   | `.claude/hooks/guard-git-push.mjs`      | Blocks force pushes and pushes to `main`/`master`/`production`, however the command is written                                     |
| Secret guard hook | `.claude/hooks/guard-secrets.mjs`       | Blocks writing `.env*`, key files, or content that looks like a live credential                                                    |
| Format hook       | `.claude/hooks/format-on-edit.mjs`      | Runs Prettier and `eslint --fix` on every file Claude edits; shows remaining lint errors to Claude so it fixes them                |
| MCP               | `.mcp.json`                             | Playwright: Claude can open the running app, click through it and take screenshots                                                 |
| Skills            | `.claude/skills/*/SKILL.md`             | `/add-api-route`, `/change-data-model`, `/triage-test`, `/pr-description`, `/review`                                               |
| Subagents         | `.claude/agents/*.md`                   | `code-reviewer`, `test-writer`, `docs-writer`                                                                                      |
| CI review         | `.github/workflows/claude-review.yml`   | Claude reviews every non-draft PR and leaves inline comments                                                                       |

## 3. Daily workflows

### Build a feature

```text
git switch -c feat/link-descriptions
claude
> /change-data-model add optional 'description' string, max 280 chars, shown under the title
> /add-api-route PATCH /api/links/[id] to edit title, url, tags and description
> /review
> /pr-description
```

Then read the diff yourself, commit, and open the PR with `gh pr create`. Claude will ask
before pushing.

### Fix a failing test or CI run

```text
> /triage-test src/lib/links/store.test.ts
```

or paste the failing CI log after `/triage-test`. Claude classifies the cause (code bug, stale
test, isolation, environment) before changing anything.

### Add tests to existing code

```text
> Use the test-writer subagent to cover the DELETE route's edge cases.
```

### Keep docs current after a merge

```text
> Use the docs-writer subagent on the diff from main.
```

### Check the UI in a browser

Start `npm run dev` in another terminal, then:

```text
> Open http://localhost:3000 with Playwright, add a link tagged "qa", filter by #qa,
> and screenshot the result.
```

## 4. Code review flow

1. **Before the PR (local):** `/review`. It runs `npm run check`, asks the `code-reviewer`
   subagent for findings, and asks `test-writer` for missing test cases. Fix blocking items.
2. **On the PR (CI):** `claude-review.yml` runs on every non-draft PR and comments inline.
   It uses the same reviewer rules, so local and CI reviews agree.
3. **A human approves.** Claude's review is a first pass, not the approval. Branch protection
   on `main` should require one human review and a green `CI` check.

To enable the CI review: a repo admin installs the Claude GitHub app (`/install-github-app`)
and adds `ANTHROPIC_API_KEY` as a repository secret. The key never goes in a file.

## 5. Guardrails: what Claude can and can't do here

**Runs without asking:** `npm test`, `npm run lint|typecheck|build|check|format`,
`npx vitest run`, read-only git commands, creating branches, `gh pr view|diff|checks`.

**Asks first:** `git push`, `git rebase`, `npm install`/`uninstall`, `gh pr create|merge`,
edits to `.github/workflows/**` and `.claude/settings.json`.

**Blocked:** reading `.env*` (except `.env.example`), key files, `~/.ssh`, `~/.aws`;
force push and pushing to `main`; `git reset --hard`, `git clean`, `git branch -D`; `rm -rf`;
`sudo`; deploy and publish commands; production database commands.

Know the limits:

- Bash deny rules match the command as written. They stop the normal form of a command, not
  every way to run it. We tested 22 ways (plus a 23rd a reader reported) to force-push or push to `main`
  ([results](bypass-test-results.md)): the deny rules alone hard-blocked 7. The other 15 fell
  through to a permission prompt, one "yes" (or one auto-approve mode) away from running.
- The `guard-git-push` hook closes that gap for pushes. It reads the whole command and blocks
  force flags (`-f`, `--force*`, `+ref`, `--delete`, `--mirror`, `--all`) and any push whose
  target is `main`, `master` or `production`, including when the push is chained (`&&`, `;`,
  `|`), wrapped (`git -C`, `git -c`, env vars, `/usr/bin/git`, `xargs`, `timeout`), aliased
  (`git -c alias.p=push`), nested in `sh -c`, `bash -c`, `eval` or `$(...)`, or inside a local
  script run with `bash file.sh`, `source` or `./file.sh`. Every push must **name its branch**
  (`git push origin my-branch`): a bare `git push` is blocked, because git would decide what to
  push from config (push refspecs, `push.default`, mirror, include files). Pushes that carry
  config or repository overrides (`-c`, `--config-env`, `--git-dir`, `GIT_CONFIG*`/`GIT_DIR`
  env vars) are blocked, and aliases defined in git config are expanded and checked.
- What the hook does **not** protect against:
  - Commands that don't go through Claude's Bash tool: your own terminal, git GUIs, CI jobs.
  - Indirection it can't read: `npm run <script>`, a Makefile target, a compiled binary, a
    script that downloads or builds the push command at runtime, or a script edited after
    the check ran.
  - Pushes made without the `git` CLI (GitHub API via `gh api` or `curl`, other git clients).
  - Anyone who edits or removes the hook: it lives in the repo like any other code.
    So branch protection on `main` (required review, no force push) and keeping deploy
    credentials out of developer machines are still the real backstops. The hook makes the
    safe path the default inside Claude Code; it is not a security boundary.
- For stronger isolation, turn on Claude Code's sandbox (`/sandbox`), which enforces file and
  network limits at the OS level.
- The secret guard catches common key formats and hard-coded `apiKey = "..."` assignments.
  It is a seatbelt, not a scanner. Keep a secret scanner (e.g. GitHub secret scanning) on.

## 6. Changing the setup

- Changes to `CLAUDE.md`, skills, agents, hooks or `.claude/settings.json` go through a PR
  like any other code. Tag the person who owns the setup.
- Hook tests live in `.claude/hooks/*.test.mjs` and run with `npm test`. To add a protected
  branch, edit `PROTECTED` in `guard-git-push.mjs` and add a deny rule for it.
- Keep `CLAUDE.md` short. If a rule only matters for one workflow, put it in that skill.
- If Claude keeps making the same mistake, add one line to `CLAUDE.md` or the relevant skill,
  and mention it in the PR.

## 7. Troubleshooting

| Symptom                              | Fix                                                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompts for `npm test` every time    | You haven't accepted workspace trust. Restart `claude` in the repo root and accept.                                                            |
| `guard-secrets` blocked a legit file | Use an obvious placeholder (`your-api-key`) or read from `process.env`. If it's a false positive, open a PR against the hook with a test case. |
| Format hook reports ESLint errors    | That's intended: Claude should fix them. If it loops, run `npm run lint` yourself and check the rule.                                          |
| Playwright tools missing             | Run `/mcp` and approve `playwright`; run `npx playwright install chromium`.                                                                    |
| A skill doesn't show in `/`          | Check the `SKILL.md` frontmatter is valid YAML and restart the session.                                                                        |
