import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { checkCommand } from "./guard-git-push.mjs";

// Throwaway repos so "git push" with no branch has a known current branch.
let onMain;
let onFeature;
beforeAll(() => {
  const make = (branch) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guard-git-push-"));
    execFileSync("git", ["init", "-q", "-b", branch], { cwd: dir });
    fs.writeFileSync(path.join(dir, "ship.sh"), "#!/bin/sh\ngit push -f origin main\n");
    fs.writeFileSync(path.join(dir, "ok.sh"), "#!/bin/sh\nnpm test\n");
    return dir;
  };
  onMain = make("main");
  onFeature = make("feature-x");
});
afterAll(() => {
  for (const dir of [onMain, onFeature]) fs.rmSync(dir, { recursive: true, force: true });
});

describe("guard-git-push hook", () => {
  it.each([
    "git push --force origin main",
    "git push -f origin main",
    "git push --force-with-lease origin main",
    "git push --force-with-lease=main:abc123 origin feature-x",
    "git push -uf origin feature-x",
    "git push origin +main",
    "git push origin +feature-x",
    "git push origin HEAD:main",
    "git push origin HEAD:refs/heads/main",
    "git push origin main:main",
    "git push origin master",
    "git push origin production",
    "git push origin --delete feature-x",
    "git push --mirror",
    "git push --all",
    "git push --all --force",
    "git push",
    "git push origin",
    "git push origin HEAD",
    "git -C . push --force origin main",
    "git -c core.askPass=true push -f origin main",
    "GIT_TRACE=0 git push -f origin main",
    "/usr/bin/git push -f origin main",
    "timeout 30 git push -f origin main",
    "cd . && git push --force origin main",
    "git status; git push -f origin main",
    "git status | cat || git push -f origin main",
    'sh -c "git push -f origin main"',
    "bash -lc 'git push --force origin main'",
    'eval "git push -f origin main"',
    'echo "$(git push -f origin main)"',
    "git -c alias.p=push p -f origin main",
    "git config alias.p push && git p -f origin main",
    "echo main | xargs -I{} git push -f origin {}",
    'git push origin "$BRANCH"',
    "bash ship.sh",
    "sh ./ship.sh",
    "source ship.sh",
    "python3 -c \"import subprocess; subprocess.run(['git', 'push', '-f', 'origin', 'main'])\"",
  ])("blocks %s", (command) => {
    expect(checkCommand(command, onMain)).not.toBeNull();
  });

  it.each([
    "git push origin feature-x",
    "git push -u origin feature-x",
    "git push --set-upstream origin feat/link-descriptions",
    "git push origin feature/main-menu",
    "git push origin HEAD:feature-x",
    "git status && git push origin feature-x",
    "git log --oneline main",
    "git switch main",
    "git diff main...HEAD",
    "npm test",
    "bash ok.sh",
    "echo 'remember to push to main later'",
  ])("allows %s", (command) => {
    expect(checkCommand(command, onMain)).toBeNull();
  });

  it("allows a bare git push only when the current branch is not protected", () => {
    expect(checkCommand("git push", onFeature)).toBeNull();
    expect(checkCommand("git push origin HEAD", onFeature)).toBeNull();
    expect(checkCommand("git push", onMain)).toMatch(/current branch \(main\)/);
  });
});
