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
const GIT_OPTS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"]);
// git push options that take a separate value argument
const PUSH_OPTS_WITH_VALUE = new Set(["-o", "--push-option", "--repo", "--receive-pack", "--exec"]);
const MAX_DEPTH = 4;

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

const isProtected = (ref) => PROTECTED.includes(ref.replace(/^refs\/heads\//, ""));

/** @returns {string | null} reason to block a single `git ...` invocation */
function checkGit(words, ctx) {
  let i = 1;
  let gitCwd = ctx.cwd;
  const aliases = { ...ctx.aliases };
  while (i < words.length && words[i].startsWith("-")) {
    const opt = words[i];
    if (GIT_OPTS_WITH_VALUE.has(opt)) {
      const value = words[i + 1] ?? "";
      if (opt === "-C") gitCwd = path.resolve(gitCwd, value);
      if (opt === "-c") {
        const m = /^alias\.([^=]+)=(.*)$/.exec(value);
        if (m) aliases[m[1]] = m[2];
      }
      i += 2;
    } else i++;
  }
  let sub = words[i];
  let args = words.slice(i + 1);
  if (sub && aliases[sub]) {
    const expansion = aliases[sub].replace(/^!\s*git\s+/, "").replace(/^!/, "");
    const [first, ...rest] = expansion.split(/\s+/).filter(Boolean);
    sub = first;
    args = [...rest, ...args];
  }
  if (sub !== "push") return null;

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
  if (!refspecs.length) {
    const branch = currentBranch(gitCwd);
    if (!branch || isProtected(branch))
      return `\`git push\` with no branch pushes the current branch (${branch ?? "unknown"})`;
    return null;
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
  for (const raw of splitCommands(command)) {
    const words = unwrap(raw);
    if (!words.length) continue;
    const name = path.basename(words[0]);

    // git config alias.x push  ->  remember the alias for later commands in this line
    if (name === "git") {
      const cfg = words.indexOf("config");
      const m = cfg > 0 ? /^alias\.(.+)$/.exec(words[cfg + 1] ?? "") : null;
      if (m && words[cfg + 2]) aliases[m[1]] = words[cfg + 2];
      const reason = checkGit(words, { cwd, aliases });
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
