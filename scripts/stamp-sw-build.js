#!/usr/bin/env node
// Rewrites sw.js's SW_BUILD constant to "<UTC timestamp>-<commit hash>" (the
// hash being that of the commit being made's parent) and re-stages sw.js,
// so every commit that touches the app shell carries a build stamp
// guaranteed to differ from every prior one — that's what makes the
// browser's service-worker update check (which only diffs sw.js's own
// bytes) actually fire. See sw.js for the full explanation. The timestamp
// half exists purely for humans (so "which build is a user on" can be read
// straight off SW_BUILD without a git log lookup) — the hash half is what
// actually guarantees uniqueness.
//
// Run automatically by scripts/git-hooks/pre-commit; not meant to be run
// by hand, though doing so is harmless (it just re-stamps sw.js again).
//
// Only touches sw.js when this commit actually changes something in the
// deployed app shell — a docs-only or plan-file-only commit shouldn't force
// every installed user through a cache-busting "update available" prompt.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = execSync('git rev-parse --show-toplevel').toString().trim();
const swPath = path.join(repoRoot, 'sw.js');

const stagedFiles = execSync('git diff --cached --name-only', { cwd: repoRoot })
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

const SHELL_PATTERNS = [/^index\.html$/, /^manifest\.json$/, /^css\//, /^js\//, /^icons\//];
const touchesShell = stagedFiles.some(f => SHELL_PATTERNS.some(p => p.test(f)));
if (!touchesShell) {
  process.exit(0);
}

let parentHash = 'initial';
try {
  parentHash = execSync('git rev-parse --short HEAD', { cwd: repoRoot }).toString().trim();
} catch {
  // No HEAD yet (first commit in a brand-new repo) — 'initial' is fine,
  // it's unique enough for that one-time case.
}

// UTC, not local time — this stamp may be read by whoever's debugging a
// user's install, not necessarily the person who made the commit, so a
// fixed reference point avoids "whose timezone is this?" ambiguity.
// Format: YYYYMMDDTHHmmZ, e.g. 20260909T1432Z.
function utcStamp(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}Z`;
}

const buildStamp = `${utcStamp(new Date())}-${parentHash}`;

const src = fs.readFileSync(swPath, 'utf8');
const updated = src.replace(/const SW_BUILD = '[^']*';/, `const SW_BUILD = '${buildStamp}';`);
if (updated === src) {
  console.error(
    "stamp-sw-build: could not find `const SW_BUILD = '...';` in sw.js — " +
    'has the constant been renamed? Update the regex in this script to match.'
  );
  process.exit(1);
}

fs.writeFileSync(swPath, updated);
execSync('git add sw.js', { cwd: repoRoot });
console.log(`stamp-sw-build: sw.js SW_BUILD -> '${buildStamp}'`);
