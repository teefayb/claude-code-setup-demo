#!/usr/bin/env node
// PreToolUse hook for Bash.
// Blocks (exit 2) force pushes and pushes to protected branches, including when the push is
// chained (&&, ;, |), wrapped (env vars, timeout, xargs, /usr/bin/git, git -C/-c), or nested
// inside sh -c / bash -c / eval / $(...) or a local script file. Deny rules in
// .claude/settings.json are the first layer; this hook covers the forms they can't match.
// Pure checks live in checkCommand() so they can be unit-tested without stdin.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROTECTED = ["main", "master", "production"];

const WRAPPERS = new Set([
  "timeout",
  "time",
  "nice",
  "nohup",
  "stdbuf",
  "command",
  "builtin",
  "noglob",
  "exec",
  "env",
  "sudo",
  "xargs",
]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
// git global options that take a separate value argument
const GIT_OPTS_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--config-env",
  "--git-dir",
  "--work-tree",
  "--namespace",
]);
// git push options that take a separate value argument
const PUSH_OPTS_WITH_VALUE = new Set(["-o", "--push-option", "--repo", "--receive-pack", "--exec"]);
const MAX_DEPTH = 4;
const KNOWN_SUBCOMMANDS = new Set(
  "add am apply archive bisect blame branch bundle cat-file check-ignore checkout cherry cherry-pick clean clone commit config count-objects describe diff diff-files diff-index diff-tree fetch for-each-ref format-patch fsck gc grep hash-object help init lfs log ls-files ls-remote ls-tree merge merge-base mv name-rev notes pull push range-diff rebase reflog remote reset restore rev-list rev-parse revert rm send-pack http-push shortlog show show-ref sparse-checkout stash status submodule switch symbolic-ref tag update-index update-ref var version worktree".split(
    " ",
  ),
);

/** Split a command line into simple commands (arrays of words), honouring quotes. */
export function splitCommands(text) {
  const commands = [];
  let words = [];
  let word = "";
  let inWord = false;
  const endWord = () => {
    if (inWord) words.push(word);
    word = "";
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") {
      const end = text.indexOf("'", i + 1);
      word += text.slice(i + 1, end === -1 ? text.length : end);
      inWord = true;
      i = end === -1 ? text.length : end;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') {
        if (text[j] === "\\" && j + 1 < text.length) j++;
        word += text[j];
        j++;
      }
      inWord = true;
      i = j;
    } else if (ch === "\\" && i + 1 < text.length) {
      word += text[++i];
      inWord = true;
    } else if (/\s/.test(ch)) {
      if (ch === "\n") endCommand();
      else endWord();
    } else if (";&|(){}`".includes(ch)) {
      endCommand();
    } else if (ch === "$" && text[i + 1] === "(") {
      endCommand();
      i++;
    } else {
      word += ch;
      inWord = true;
    }
  }
  endCommand();
  return commands;
}

/** Strip env assignments and wrappers; returns the words of the real command. */
function unwrap(words) {
  let w = [...words];
  for (;;) {
    while (w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0])) w.shift();
    if (!w.length) return w;
    const name = path.basename(w[0]);
    if (!WRAPPERS.has(name)) return w;
    w.shift();
    // skip the wrapper's own flags and a numeric arg (timeout 30, nice -n 5)
    while (w.length && (w[0].startsWith("-") || /^\d+[smhd]?$/.test(w[0]))) {
      const flag = w.shift();
      if (name === "xargs" && /^-[IEdLnPs]$/.test(flag)) w.shift();
      if (name === "nice" && flag === "-n") w.shift();
    }
  }
}

function currentBranch(cwd) {
  try {
    return execFileSync("git", ["symbolic-ref", "--short", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    }).trim();
  } catch {
    return null;
  }
}

/** Look up an alias defined in git config (e.g. `alias.p = push -f origin main`). */
function configAlias(cwd, name) {
  try {
    return execFileSync("git", ["config", "--get", `alias.${name}`], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    }).trim();
  } catch {
    return null;
  }
}

// Options and env vars that change which config or repository a push uses.
const PUSH_REDIRECT_OPTS =
  /^(-c|--config-env(=.*)?|--git-dir(=.*)?|--work-tree(=.*)?|--namespace(=.*)?)$/;
const PUSH_REDIRECT_ENV = /\bGIT_(CONFIG\w*|DIR|WORK_TREE|NAMESPACE|COMMON_DIR)\b/;

const isProtected = (ref) => PROTECTED.includes(ref.replace(/^refs\/heads\//, ""));

/** @returns {string | null} reason to block a single `git ...` invocation */
function checkGit(words, ctx) {
  let i = 1;
  let gitCwd = ctx.cwd;
  const aliases = { ...ctx.aliases };
  let redirect = null;
  while (i < words.length && words[i].startsWith("-")) {
    const opt = words[i];
    if (GIT_OPTS_WITH_VALUE.has(opt)) {
      const value = words[i + 1] ?? "";
      if (opt === "-C") gitCwd = path.resolve(gitCwd, value);
      if (opt === "-c") {
        const m = /^alias\.([^=]+)=(.*)$/.exec(value);
        if (m) aliases[m[1]] = m[2];
      }
      if (opt !== "-C") redirect ??= opt;
      i += 2;
    } else {
      if (PUSH_REDIRECT_OPTS.test(opt)) redirect ??= opt.split("=")[0];
      i++;
    }
  }
  let sub = words[i];
  let args = words.slice(i + 1);
  for (let hops = 0; sub && !KNOWN_SUBCOMMANDS.has(sub); hops++) {
    const expansion = aliases[sub] ?? configAlias(gitCwd, sub);
    if (!expansion) break;
    if (hops >= 5) return "alias chain too deep to check";
    if (expansion.trimStart().startsWith("!")) {
      // Shell alias: check the whole body as a command line.
      const body = expansion.trimStart().slice(1);
      return ctx.check(`${body} ${args.join(" ")}`, gitCwd);
    }
    const [first, ...rest] = splitCommands(expansion)[0] ?? [];
    sub = first;
    args = [...rest, ...args];
  }
  // `git config [set|--global|...] alias.x VALUE` (also via an alias): remember x for later commands
  if (sub === "config") {
    const k = args.findIndex((a) => /^alias\./.test(a));
    if (k >= 0 && args[k + 1]) ctx.aliases[args[k].slice(6)] = args[k + 1];
  }
  if (sub === "send-pack" || sub === "http-push")
    return `\`git ${sub}\` updates remote refs directly; use \`git push origin <branch>\``;
  if (sub !== "push") return null;
  if (redirect) return `\`${redirect}\` on a push changes which config or repository git uses`;

  const positional = [];
  let force = false;
  let everything = null;
  for (let j = 0; j < args.length; j++) {
    const a = args[j];
    if (PUSH_OPTS_WITH_VALUE.has(a)) {
      j++;
      continue;
    }
    if (/^--force(-with-lease|-if-includes)?(=|$)/.test(a) || /^-[A-Za-z]*f[A-Za-z]*$/.test(a))
      force = true;
    else if (a === "--mirror") everything = "--mirror";
    else if (a === "--all" || a === "--branches") everything = a;
    else if (a === "--delete" || a === "-d") force = true;
    else if (!a.startsWith("-")) positional.push(a);
  }
  if (force) return "force pushes are blocked";
  if (everything) return `\`git push ${everything}\` would push protected branches`;

  const refspecs = positional.slice(1);
  if (!refspecs.length && args.includes("--tags") && !args.includes("--follow-tags")) return null;
  if (!refspecs.length) {
    const branch = currentBranch(gitCwd);
    if (!branch || isProtected(branch))
      return `\`git push\` with no branch pushes the current branch (${branch ?? "unknown"})`;
    // Without a refspec, git decides what to push from config (push refspecs, push.default,
    // mirror, include files...). Require it on the command line instead of second-guessing git.
    return `name the branch explicitly: \`git push ${positional[0] ?? "origin"} ${branch}\``;
  }
  for (const spec of refspecs) {
    if (spec.startsWith("+")) return `"${spec}" is a force push`;
    if (/[$`*]/.test(spec)) return `can't verify the target of "${spec}"`;
    const dst = spec.includes(":") ? spec.slice(spec.indexOf(":") + 1) : spec;
    const target = dst === "HEAD" || dst === "@" ? currentBranch(gitCwd) : dst;
    if (!target || isProtected(target)) return `pushing to ${target ?? "an unknown branch"}`;
  }
  return null;
}

// Last resort for text we can't parse as a git call (python -c, node -e, heredocs, functions).
const OPAQUE_PUSH =
  /\bgit\b[\s\S]*\bpush\b[\s\S]*((^|[\s'",[(])(-f|--force\S*|--mirror|--all)(?=$|[\s'",\])])|(^|[\s'",:+[(])\+?(refs\/heads\/)?(main|master|production)(?=$|[\s'",\])]))/;

/** @returns {string | null} reason to block, or null to allow */
export function checkCommand(command, cwd = process.cwd(), depth = 0, aliases = {}) {
  if (!command) return null;
  if (depth > MAX_DEPTH)
    return /\bpush\b/.test(command) ? "command nesting too deep to check" : null;
  // GIT_CONFIG*/GIT_DIR change which config or repo every later git call uses, including inside
  // bash -c, eval and scripts. Too much to follow, so fail closed when they're set alongside git.
  if (
    PUSH_REDIRECT_ENV.test(command) &&
    /\bgit\b|\b(ba|z|da|k)?sh\b|\beval\b|\bsource\b|\.sh\b/.test(command)
  )
    return "GIT_CONFIG*/GIT_DIR environment overrides together with git or a script can't be checked";
  for (const raw of splitCommands(command)) {
    const words = unwrap(raw);
    if (!words.length) continue;
    const name = path.basename(words[0]);
    // 6: follow `cd` so branch and alias lookups use the right repo
    if (name === "cd") {
      if (words[1] && !/^[~-]/.test(words[1])) cwd = path.resolve(cwd, words[1]);
      else return /\bpush\b|\bgit\b/.test(command) ? "can't follow `cd` to that directory" : null;
      continue;
    }

    // git config alias.x push  ->  remember the alias for later commands in this line
    if (name === "git") {
      // Config or repo redirected through the environment, anywhere on the line (incl. earlier `export`)
      const reason = checkGit(words, {
        cwd,
        aliases,
        check: (cmd, dir) => checkCommand(cmd, dir, depth + 1, aliases),
      });
      if (reason) return reason;
      continue;
    }
    if (SHELLS.has(name)) {
      const cIdx = words.findIndex((w, k) => k > 0 && /^-[a-z]*c[a-z]*$/.test(w));
      if (cIdx > 0) {
        const reason = checkCommand(words[cIdx + 1] ?? "", cwd, depth + 1, aliases);
        if (reason) return reason;
        continue;
      }
      const file = words.slice(1).find((w) => !w.startsWith("-"));
      const reason = file && checkScript(path.resolve(cwd, file), cwd, depth, aliases);
      if (reason) return reason;
      continue;
    }
    if (name === "eval") {
      const reason = checkCommand(words.slice(1).join(" "), cwd, depth + 1, aliases);
      if (reason) return reason;
      continue;
    }
    if (name === "source" || name === ".") {
      const reason = words[1] && checkScript(path.resolve(cwd, words[1]), cwd, depth, aliases);
      if (reason) return reason;
      continue;
    }
    if (words[0].includes("/")) {
      const reason = checkScript(path.resolve(cwd, words[0]), cwd, depth, aliases);
      if (reason) return reason;
    }
    const text = raw.join(" ");
    if (OPAQUE_PUSH.test(text))
      return "this command appears to run a force push or a push to a protected branch";
  }
  return null;
}

function checkScript(file, cwd, depth, aliases) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 256 * 1024) return null;
    const text = fs.readFileSync(file, "utf8");
    if (text.includes("\0")) return null; // binary
    const reason = checkCommand(text, cwd, depth + 1, aliases);
    return reason ? `${path.basename(file)}: ${reason}` : null;
  } catch {
    return null;
  }
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const { tool_input: input = {}, cwd } = JSON.parse(raw || "{}");
  const reason = checkCommand(input.command ?? "", cwd || process.cwd());
  if (reason) {
    process.stderr.write(
      `guard-git-push: ${reason}. Push a feature branch and open a PR instead; protected branches (${PROTECTED.join(", ")}) change only through review.\n`,
    );
    process.exit(2);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // Fail closed when the command mentions a push; otherwise stay out of the way.
    process.stderr.write(`guard-git-push: hook error: ${err.message}\n`);
    process.exit(/\bpush\b/.test(String(err.command ?? "")) ? 2 : 0);
  });
}
