#!/usr/bin/env node
// Rewrites sw.js's SW_BUILD constant to "<UTC timestamp>-<tree hash>" and
// re-stages sw.js, so every commit carries a build stamp guaranteed to differ
// from every prior one — that's what makes the browser's service-worker
// update check (which only diffs sw.js's own bytes) actually fire. See sw.js
// for the full explanation. The timestamp half exists purely for humans (so
// "which build is a user on" can be read straight off SW_BUILD without a git
// log lookup) — the hash half is what actually guarantees uniqueness.
//
// The hash is a git tree hash (`git write-tree`), not a commit hash. A commit
// hash is derived from its tree, which includes sw.js's own bytes — so a
// commit can never correctly embed its own hash inside a tracked file:
// stamping it in changes the tree, which changes the hash you just stamped.
// (An earlier version of this script used `git rev-parse HEAD`, which is
// only ever the *parent* commit at pre-commit time — every build was
// stamped with the hash of the commit before it, permanently one behind.)
// `git write-tree` sidesteps this: called here, before this script rewrites
// sw.js, it hashes the tree exactly as staged — i.e. the tree this commit is
// about to get — with no self-reference involved.
//
// Run automatically by scripts/git-hooks/pre-commit; not meant to be run
// by hand, though doing so is harmless (it just re-stamps sw.js again).
//
// Runs unconditionally on every commit — including ones that don't touch
// any deployed file (docs, scripts, plan files) — by deliberate choice: the
// alternative (only stamping when a commit touches an app-shell path) meant
// a change's stamp status was a fact you had to remember or go check,
// rather than something you could always rely on.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = execSync('git rev-parse --show-toplevel').toString().trim();
const swPath = path.join(repoRoot, 'sw.js');

let treeHash = 'initial';
try {
  treeHash = execSync('git write-tree', { cwd: repoRoot }).toString().trim().slice(0, 7);
} catch {
  // Unmerged index (mid-conflict-resolution commit) or similar — 'initial'
  // is fine, it's unique enough for that one-time case.
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

const buildStamp = `${utcStamp(new Date())}-${treeHash}`;

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
