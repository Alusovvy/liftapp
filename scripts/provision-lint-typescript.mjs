#!/usr/bin/env node
// typescript-eslint (and the classic TypeScript compiler API it needs to
// parse .ts/.tsx files) does not yet support TypeScript 7's native/Go
// rewrite, which this project pins as its real `typescript` devDependency
// for `tsc --noEmit` (see https://github.com/typescript-eslint/typescript-eslint/issues/10940).
// TS 7's npm package no longer ships a classic `typescript.js` API at all,
// so typescript-eslint cannot run against it under any configuration.
//
// `typescript` is a peerDependency of the `@typescript-eslint/*` packages,
// so npm's `overrides` field cannot give them their own nested copy the way
// it can for a regular dependency conflict — peers are expected to share one
// resolved instance, and the root project's own `typescript@7` devDependency
// wins that resolution.
//
// This script provisions a real, working TypeScript copy into whichever
// nested `node_modules` directory each typescript-eslint package would
// actually check *before* reaching the project root (computed the same way
// Node's own `require()` resolution walks up the directory tree), so the
// exact npm hoisting layout doesn't matter and this keeps working across
// `npm install` runs that shuffle it. Remove this once typescript-eslint
// supports TS 7, or once this project's own `tsc` moves to a version it
// already supports.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import Module from "node:module";

const REQUIRED_VERSION = "5.7.3";
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const rootNodeModules = join(projectRoot, "node_modules");
const require = createRequire(import.meta.url);

// Every package in the typescript-eslint dependency tree observed to call
// `require("typescript")` directly (checked with:
// `grep -rl 'require("typescript")' node_modules/@typescript-eslint node_modules/typescript-eslint node_modules/ts-api-utils`).
// Re-run that grep and extend this list if a future typescript-eslint
// release adds another one.
const PACKAGES_NEEDING_TYPESCRIPT = [
  "typescript-eslint",
  "@typescript-eslint/eslint-plugin",
  "@typescript-eslint/parser",
  "@typescript-eslint/typescript-estree",
  "@typescript-eslint/utils",
  "@typescript-eslint/type-utils",
  "ts-api-utils",
];

function firstNonRootNodeModulesDir(startDir) {
  for (const candidate of Module._nodeModulePaths(startDir)) {
    if (candidate !== rootNodeModules) return candidate;
  }
  return null;
}

function installedVersion(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;
  } catch {
    return null;
  }
}

// Some packages (e.g. ts-api-utils) restrict their `exports` map and refuse
// `require.resolve("<pkg>/package.json")`, so resolve their main entry file
// instead and walk up to the directory whose package.json declares that name.
function packageDirFor(pkg) {
  let file;
  try {
    file = require.resolve(pkg);
  } catch {
    return null;
  }
  let dir = dirname(file);
  while (dir !== dirname(dir)) {
    const name = (() => {
      try {
        return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name;
      } catch {
        return null;
      }
    })();
    if (name === pkg) return dir;
    dir = dirname(dir);
  }
  return null;
}

if (!existsSync(join(rootNodeModules, "typescript-eslint"))) {
  // Nothing to patch yet (e.g. a plain `npm install` without dev tooling).
  process.exit(0);
}

const targets = new Set();
for (const pkg of PACKAGES_NEEDING_TYPESCRIPT) {
  const pkgDir = packageDirFor(pkg);
  if (!pkgDir) continue;
  const target = firstNonRootNodeModulesDir(pkgDir);
  if (target) targets.add(target);
}

const pending = [...targets].filter(
  (dir) => installedVersion(join(dir, "typescript")) !== REQUIRED_VERSION,
);
if (pending.length === 0) process.exit(0);

const scratch = mkdtempSync(join(tmpdir(), "liftwise-lint-ts-"));
try {
  execFileSync(
    "npm",
    ["install", "--no-save", "--no-audit", "--no-fund", `typescript@${REQUIRED_VERSION}`],
    { cwd: scratch, stdio: "inherit" },
  );
  const source = join(scratch, "node_modules", "typescript");
  for (const dir of pending) {
    const target = join(dir, "typescript");
    rmSync(target, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    cpSync(source, target, { recursive: true });
    console.log(`Provisioned typescript@${REQUIRED_VERSION} for typescript-eslint at ${target}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
