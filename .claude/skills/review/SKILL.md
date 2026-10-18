---
name: review
description: Review the current branch's changes against main before opening a PR, using the code-reviewer subagent and this repo's checks. Use when asked to review local changes.
argument-hint: "[optional base branch, default main]"
disable-model-invocation: true
---

Base branch for this review: "$ARGUMENTS" (use `main` if that is empty).

1. Run `git diff --stat <base>...HEAD` and `git status`. Include uncommitted changes in scope.
   If there are no changes, say so and stop.
2. Run `npm run check` and record the result. Don't fix anything yet.
3. Delegate to the **code-reviewer** subagent with: the base branch, the list of changed
   files, and the `npm run check` output. Ask it to return findings only.
4. If source files changed without matching test changes, also ask the **test-writer**
   subagent to list the missing test cases (list only, no code yet).
5. Present one combined report:

   **Verdict:** ready / ready after fixes / needs rework
   **Blocking** — bugs, security, broken conventions from CLAUDE.md (file:line, why, fix)
   **Should fix** — missing tests, unclear naming, error handling gaps
   **Nits** — optional, max 5
   **Checks** — `npm run check` result

6. Ask before applying any fix.
