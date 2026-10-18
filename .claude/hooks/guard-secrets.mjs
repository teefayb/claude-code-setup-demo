#!/usr/bin/env node
// PreToolUse hook for Write|Edit.
// Blocks (exit 2) when Claude tries to write a secret-bearing file or content that
// looks like a live credential. The stderr message is shown to Claude as the reason.
// Pure checks live in checkWrite() so they can be unit-tested without stdin.

import path from "node:path";
import { fileURLToPath } from "node:url";

const BLOCKED_FILES = [
  { test: (name) => /^\.env($|\.)/.test(name) && name !== ".env.example", why: ".env files" },
  { test: (name) => /\.(pem|key|p12|pfx)$/.test(name), why: "key/certificate files" },
  { test: (name) => /^id_(rsa|ed25519|ecdsa)/.test(name), why: "SSH keys" },
];

const SECRET_PATTERNS = [
  { re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/, why: "AWS access key id" },
  { re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, why: "GitHub token" },
  { re: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/, why: "GitHub fine-grained token" },
  { re: /\bsk-ant-[A-Za-z0-9_-]{20,}/, why: "Anthropic API key" },
  { re: /\bsk-(proj-)?[A-Za-z0-9_-]{32,}/, why: "OpenAI-style API key" },
  { re: /\b[rs]k_live_[A-Za-z0-9]{16,}/, why: "Stripe live key" },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/, why: "Slack token" },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, why: "Google API key" },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: "private key block" },
];

// key = "long literal" assignments, unless the value is obviously a placeholder.
// Matches apiKey, API_KEY, clientSecret, DB_PASSWORD, GITHUB_TOKEN; not tokenUrl or author.
const ASSIGNMENT =
  /\b\w*?(api[_-]?key|secret|password|passwd|token)\b\s*[:=]\s*["'`]([^"'`\s]{16,})["'`]/gi;
const PLACEHOLDER =
  /(example|placeholder|changeme|dummy|fake|test|xxxx|\$\{|<.*>|^https?:\/\/|^[./])/i;

/** @returns {string | null} reason to block, or null to allow */
export function checkWrite(filePath, content) {
  const name = path.basename(filePath ?? "");
  for (const rule of BLOCKED_FILES) {
    if (rule.test(name))
      return `Writing ${rule.why} (${name}) is blocked. Put secrets in the team secret manager and document the variable name in .env.example.`;
  }
  const text = content ?? "";
  for (const { re, why } of SECRET_PATTERNS) {
    if (re.test(text))
      return `This content looks like it contains a credential (${why}). Read it from process.env instead, and keep the value in the secret manager.`;
  }
  for (const match of text.matchAll(ASSIGNMENT)) {
    if (!PLACEHOLDER.test(match[2])) {
      return `"${match[1]}" is assigned a hard-coded value. Read it from process.env instead.`;
    }
  }
  return null;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const { tool_input: input = {} } = JSON.parse(raw || "{}");
  const content = input.content ?? input.new_string ?? "";
  const reason = checkWrite(input.file_path, content);
  if (reason) {
    process.stderr.write(`guard-secrets: ${reason}\n`);
    process.exit(2);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // Fail closed is too noisy for a parse bug; fail open but say so.
    process.stderr.write(`guard-secrets: hook error, write allowed: ${err.message}\n`);
    process.exit(0);
  });
}
