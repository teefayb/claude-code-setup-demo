---
name: pr-description
description: Write a pull request title and description for the current branch from its diff and commits, in the team's PR format. Use before opening a PR.
disable-model-invocation: true
allowed-tools: Bash(git diff *) Bash(git log *) Bash(git status *) Bash(git branch --show-current)
---

Write a PR description for the current branch.

1. Gather context:
   - Branch: !`git branch --show-current`
   - Commits: !`git log --oneline main..HEAD`
   - Files changed: !`git diff --stat main...HEAD`
2. Read the full diff (`git diff main...HEAD`) before writing. Describe what the code does,
   not what the commit messages claim.
3. Output exactly this format, in a fenced markdown block so it can be pasted:

```markdown
## <imperative title, under 70 characters>

### What

<2–4 sentences: the change and why it is needed>

### How

- <key implementation points a reviewer should know>

### API / data changes

<new or changed endpoints, status codes, stored fields; "None" if none>

### Testing

- [ ] `npm run check`
- [ ] `npm run build`
- <manual steps a reviewer can follow, if any>

### Risk

<what could break, and how to roll back>
```

4. Do not invent ticket numbers, reviewers or test results. If tests were not run in this
   session, leave the boxes unchecked.
5. Do not create the PR. The author opens it with `gh pr create` after reading the text.
