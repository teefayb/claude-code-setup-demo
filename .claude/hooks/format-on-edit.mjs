#!/usr/bin/env node
// PostToolUse hook for Write|Edit.
// Runs Prettier on the edited file, then ESLint --fix for JS/TS. If ESLint still
// reports errors, exits 2 so Claude sees them and fixes them in the same turn.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const PRETTIER_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".css",
  ".yml",
  ".yaml",
]);
const ESLINT_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const { tool_input: input = {}, cwd } = JSON.parse(raw || "{}");

const root = process.env.CLAUDE_PROJECT_DIR || cwd || process.cwd();
const file = input.file_path ? path.resolve(root, input.file_path) : null;
const bin = (name) => path.join(root, "node_modules", ".bin", name);

// Only files inside this repo, and only once dependencies are installed.
if (
  !file ||
  !file.startsWith(root + path.sep) ||
  !existsSync(file) ||
  file.includes(`${path.sep}node_modules${path.sep}`)
)
  process.exit(0);
const ext = path.extname(file);

if (PRETTIER_EXT.has(ext) && existsSync(bin("prettier"))) {
  try {
    execFileSync(bin("prettier"), ["--write", "--ignore-unknown", "--log-level", "warn", file], {
      cwd: root,
      stdio: "pipe",
    });
  } catch (err) {
    process.stderr.write(
      `prettier could not format ${path.relative(root, file)}:\n${err.stderr ?? err.message}\n`,
    );
    process.exit(2);
  }
}

if (ESLINT_EXT.has(ext) && existsSync(bin("eslint"))) {
  try {
    execFileSync(bin("eslint"), ["--fix", "--no-warn-ignored", file], { cwd: root, stdio: "pipe" });
  } catch (err) {
    process.stderr.write(
      `eslint found problems in ${path.relative(root, file)}:\n${err.stdout ?? ""}${err.stderr ?? ""}\n`,
    );
    process.exit(2);
  }
}
