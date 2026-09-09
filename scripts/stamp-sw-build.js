#!/usr/bin/env node
// Rewrites sw.js's SW_BUILD constant to the current HEAD commit hash (i.e.
// the hash the commit being made will have as its parent) and re-stages
// sw.js, so every commit that touches the app shell carries a build stamp
// guaranteed to differ from every prior one — that's what makes the
// browser's service-worker update check (which only diffs sw.js's own
// bytes) actually fire. See sw.js for the full explanation.
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

const src = fs.readFileSync(swPath, 'utf8');
const updated = src.replace(/const SW_BUILD = '[^']*';/, `const SW_BUILD = '${parentHash}';`);
if (updated === src) {
  console.error(
    "stamp-sw-build: could not find `const SW_BUILD = '...';` in sw.js — " +
    'has the constant been renamed? Update the regex in this script to match.'
  );
  process.exit(1);
}

fs.writeFileSync(swPath, updated);
execSync('git add sw.js', { cwd: repoRoot });
console.log(`stamp-sw-build: sw.js SW_BUILD -> '${parentHash}'`);
