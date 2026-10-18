---
name: triage-test
description: Diagnose a failing or flaky Vitest test or a failing CI check, find the root cause, and propose or apply the smallest correct fix. Use when a test fails locally or in CI.
argument-hint: "[test file, test name, or pasted CI output]"
allowed-tools: Bash(npx vitest run *) Bash(npm test *) Bash(git log *) Bash(git diff *)
---

Triage this failure: $ARGUMENTS

## Steps

1. Reproduce. Run only the failing file: `npx vitest run <file>` (add `-t "<test name>"` to
   narrow). If no file was given, run `npm test` and pick the first failure. If it passes,
   run it 5 times (`npx vitest run <file> --repeat 4`) to check for flakiness.
2. Read the assertion diff and stack trace before reading code. Name the failing expectation.
3. Find what changed: `git log --oneline -10 -- <source file> <test file>` and
   `git diff main...HEAD -- <files>`.
4. Classify the cause, and say which one it is:
   - **Code bug** — the test is right; fix the source.
   - **Stale test** — behaviour changed on purpose; update the test and say which commit changed it.
   - **Test isolation** — shared state between tests (data file, env var, time, ordering).
     In this repo, check that the test uses `useTempDataFile()` and passes an explicit `now`
     to `createLink` instead of relying on the clock.
   - **Environment** — Node version, missing install, CI-only difference.
5. Fix the root cause. Never skip, delete or loosen an assertion just to make it pass, and
   never edit `data/seed.json` to satisfy a test without saying so.
6. Re-run the file, then `npm test`.
7. Report: cause (one sentence), classification, the fix, and the commands run.
