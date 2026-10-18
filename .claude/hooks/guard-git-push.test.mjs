import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { checkCommand } from "./guard-git-push.mjs";

// Don't let the developer's own ~/.gitconfig or system config change results.
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_NOSYSTEM = "1";

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

  it("requires an explicit branch: blocks a bare git push everywhere", () => {
    expect(checkCommand("git push", onFeature)).toMatch(
      /name the branch explicitly: `git push origin feature-x`/,
    );
    expect(checkCommand("git push origin", onFeature)).toMatch(/name the branch explicitly/);
    expect(checkCommand("git push origin HEAD", onFeature)).toBeNull();
    expect(checkCommand("git push origin feature-x", onFeature)).toBeNull();
    expect(checkCommand("git push", onMain)).toMatch(/current branch \(main\)/);
  });

  // Reader-reported gap (#23) and two rounds of independent review: git config decides what a
  // bare `git push` does, so v3 requires an explicit branch and blocks config/repo redirects.
  describe("push behaviour from git config", () => {
    const dirs = [];
    afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
    const repoWith = (settings) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guard-git-push-cfg-"));
      dirs.push(dir);
      execFileSync("git", ["init", "-q", "-b", "feature-x"], { cwd: dir });
      for (const [k, v] of settings) execFileSync("git", ["config", "--add", k, v], { cwd: dir });
      return dir;
    };

    it.each([
      [["remote.origin.push", "+refs/heads/*:refs/heads/*"]],
      [["remote.origin.push", ":"]],
      [["remote.origin.mirror", "true"]],
      [["push.default", "matching"]],
      [["push.default", "upstream"]],
    ])("blocks a bare push whatever the config (%j)", (setting) => {
      expect(checkCommand("git push", repoWith([setting]))).not.toBeNull();
    });

    it("allows an explicit feature-branch push even with odd config (git ignores it or refuses)", () => {
      const dir = repoWith([
        ["remote.origin.push", "+refs/heads/*:refs/heads/*"],
        ["remote.origin.mirror", "true"],
      ]);
      expect(checkCommand("git push origin feature-x", dir)).toBeNull();
    });

    it("blocks aliases defined in git config", () => {
      const dir = repoWith([
        ["alias.p", "push -f origin main"],
        ["alias.ship", "push origin HEAD:main"],
      ]);
      expect(checkCommand("git p", dir)).not.toBeNull();
      expect(checkCommand("git ship", dir)).not.toBeNull();
    });

    it.each([
      "git -c remote.origin.push=+refs/heads/*:refs/heads/* push origin feature-x",
      "git -c remote.origin.mirror push origin feature-x",
      "git -c include.path=../evil.cfg push origin feature-x",
      "git --config-env=push.default=MODE push origin feature-x",
      "git --config-env remote.origin.push=SPEC push origin feature-x",
      "git --git-dir=/other/.git push origin feature-x",
      "git --work-tree=/other push origin feature-x",
      "GIT_CONFIG_GLOBAL=../evil.cfg git push origin feature-x",
      "GIT_DIR=/other/.git git push origin feature-x",
      "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=push.default GIT_CONFIG_VALUE_0=matching git push origin feature-x",
      "export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=push.default GIT_CONFIG_VALUE_0=matching; git push origin feature-x",
      "env GIT_CONFIG_PARAMETERS=\"'push.default'='matching'\" git push origin feature-x",
      'git config set alias.p "push -f origin main" && git p',
      'git config --global alias.p "push -f origin main" && git p',
      "git -c alias.cf=config cf alias.p 'push -f origin main' && git p",
    ])("review finding: blocks %s", (cmd) => {
      expect(checkCommand(cmd, onFeature)).not.toBeNull();
    });

    it("still allows harmless git config and -c on non-push commands", () => {
      expect(checkCommand("git config --get-all remote.origin.push", onFeature)).toBeNull();
      expect(checkCommand("git config user.name teefayb", onFeature)).toBeNull();
      expect(checkCommand("git -c color.ui=always log --oneline", onFeature)).toBeNull();
    });
  });

  describe("review round 3", () => {
    const dirs = [];
    afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
    const repoWith = (settings) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guard-git-push-r3-"));
      dirs.push(dir);
      execFileSync("git", ["init", "-q", "-b", "feature-x"], { cwd: dir });
      for (const [k, v] of settings) execFileSync("git", ["config", "--add", k, v], { cwd: dir });
      return dir;
    };

    it("checks shell aliases, alias chains and quoted alias bodies", () => {
      expect(
        checkCommand("git -c alias.x='!f(){ git push -f origin main; }; f' x", onFeature),
      ).not.toBeNull();
      const dir = repoWith([
        ["alias.x", "!f(){ git push -f origin main; }; f"],
        ["alias.q", "pp"],
        ["alias.pp", "push -f origin main"],
        ["alias.s", 'push origin "HEAD:main"'],
        ["alias.ok", "push origin feature-x"],
      ]);
      expect(checkCommand("git x", dir)).not.toBeNull();
      expect(checkCommand("git q", dir)).not.toBeNull();
      expect(checkCommand("git s", dir)).not.toBeNull();
      expect(checkCommand("git ok", dir)).toBeNull();
    });

    it.each([
      "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.z GIT_CONFIG_VALUE_0='push -f origin main' bash -c 'git z'",
      "export GIT_DIR=/other/.git; bash push.sh",
      "git send-pack origin main",
      "git http-push https://example.com/repo.git main",
    ])("blocks %s", (cmd) => {
      expect(checkCommand(cmd, onFeature)).not.toBeNull();
    });

    it("follows cd for alias lookups", () => {
      const other = repoWith([["alias.p", "push -f origin main"]]);
      expect(checkCommand(`cd ${other} && git p`, onFeature)).not.toBeNull();
    });

    it("allows tag-only pushes but not --follow-tags without a branch", () => {
      expect(checkCommand("git push origin --tags", onFeature)).toBeNull();
      expect(checkCommand("git push --follow-tags origin", onFeature)).not.toBeNull();
      expect(checkCommand("git push --follow-tags origin feature-x", onFeature)).toBeNull();
    });

    it("doesn't block ordinary commands", () => {
      expect(checkCommand("git rev-parse HEAD", onFeature)).toBeNull();
      expect(checkCommand("cd src && ls", onFeature)).toBeNull();
      expect(checkCommand("npm run build", onFeature)).toBeNull();
    });
  });
});
