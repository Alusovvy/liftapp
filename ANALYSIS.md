# Project analysis — Liftwise (gym-raport)

Written 2026-08-03 as an outside read of the repository as it stands today. This
is my own assessment, cross-checked against the running test suite and the
source tree — not a restatement of the project's own planning documents,
though it agrees with several of their conclusions.

## What this project is

**Liftwise** is a local-first workout-tracking PWA built with Vite. There is no
backend and no account: all data lives in the browser's `localStorage`, and
the production build is a static site. Its distinguishing feature versus a
plain workout log is a rule-based ("explainable") coaching layer:

- Tracks sets at a granular level (load+reps, reps-only, duration, distance),
  with explicit load/rep conventions (per-hand, per-side, assisted, added
  bodyweight) so volume and progression stay comparable over time.
- Computes weekly effective sets per muscle group (1.0 credit for primary
  muscle, 0.5 for secondary) against user-editable target ranges, and
  produces a deterministic "next session" suggestion with a visible `WHY`.
- Uses conservative double-progression rules for load/rep advice, gated by an
  optional daily recovery check-in (sleep/energy/soreness/stress/pain) that
  can reduce, hold, or fully block a generated session on a pain report.
- Imports Hevy workout CSV exports and Fitatu nutrition CSV exports, with
  real validation, rejected-row reporting, source/content-fingerprint-based
  upsert (so correcting a workout in Hevy and re-importing actually updates
  the record instead of being silently skipped), conflict detection, and a
  one-step undo.
- Ships JSON backup/restore as the complete data format, with pre-migration
  recovery snapshots and a corrupt-data recovery path.
- Has an equipment-aware, favoritable exercise library with a home-gym
  default profile (dumbbells/barbell/bench/pull-up bar; machines hidden by
  default).

The product is explicitly scoped to be conservative and non-diagnostic: it
never issues a hidden readiness score, never diagnoses injury, and treats
volume targets as adjustable planning ranges rather than prescriptions. This
tone is enforced consistently across the code, copy, and the two planning
documents in the repo (`PRODUCT_TRANSFORMATION_PLAN.md`,
`REMAINING-WORK-SPEC.md`).

## Current engineering state

The repo is mid-migration, and it's an unusually well-documented mid-migration:

- **Two live UIs share one dataset.** `index.html` (`src/app.js`, 5,232
  lines + `src/domain.js`, 641 lines) is the original hand-rolled vanilla-JS
  app. `modern.html` (`src/app/`, `src/features/`, `src/domain/*.ts`) is an
  incremental React 19 + TypeScript rewrite, now the primary entry point
  (`npm start` opens `/modern.html`). Both read/write the same
  `liftwise-data-v1` schema (version 9), and the modern UI links out to the
  legacy app for flows not yet ported (full historical editing, routine
  authoring, recovery/body-metric correction — see `REMAINING-WORK-SPEC.md`
  P0.2).
- **Domain logic is genuinely separated from UI** in the new code
  (`src/domain/coaching`, `src/domain/optimization`, `src/domain/import`,
  `src/domain/progress`, `src/domain/body`), consumed by
  `src/features/*` page components through `src/infrastructure/local-storage`.
  This is a real strangler-fig migration, not a rewrite-in-place: dependencies
  point inward from features → selectors → domain → typed models, matching
  the architecture the plan documents describe.
- **Tests pass**: `npm test` → 110 tests across 12 files, all green, in ~2.6s.
  Coverage includes RPE/RIR provenance, import upsert/conflict/unchanged
  detection, Fitatu locale parsing (PL/EN, comma/semicolon/decimal-comma),
  storage-schema migration, and the routine-optimizer engine. There's also a
  305-line Playwright e2e spec for the modern app.
- **No CI workflow and no lint/format config exist** (`.github/workflows`,
  `.eslintrc*`, `.prettierrc*` are all absent). `npm run check` (typecheck +
  vitest + build) is the only gate, and it has to be run by hand.
- **Bundle**: the built `dist/` ships both UIs unconditionally —
  `modern-*.js` (392 KB) + `modern-*.css` (44 KB) _and_ `legacy-*.js`
  (196 KB) + `legacy-*.css` (60 KB), plus a small shared `domain-*.js`
  (16 KB). Every visitor downloads both interfaces even though only one is
  used per session.
- All commits in `git log` are dated 2026-08-03 — this looks like it was
  built in one continuous AI-assisted session rather than accreted over
  real usage, which is consistent with how thorough-but-untested-in-the-wild
  the planning docs read (usability-session targets are written as _future_
  work, not reported results).

## What's working well

- The provenance model (`rawRpe` / `explicitImportedRir` / `manualRir` /
  `manualRirCleared` / `effortSource`) is a genuinely good design: it avoids
  the common bug of an editor overwriting untouched fields, and it keeps
  imported vs. manual data distinguishable through export.
- Import identity is split into `sourceIdentity` (stable, for matching) and
  `contentFingerprint` (for detecting a real change vs. a no-op re-import),
  which is exactly the right shape for "correct it in the source and
  re-import" to actually work — and it's covered by tests, not just claimed
  in docs.
- The migration strategy (retain-then-validate-then-commit, with a bounded
  recovery key) protects the one copy of the user's data that exists, which
  matters a lot for a no-cloud app.
- The two planning documents are unusually rigorous about _not_ overclaiming
  health/fitness authority (no readiness score, no diagnosis, pain is a hard
  stop) — that discipline is visible in the actual coaching code, not just
  the prose.

## What I'd improve

1. **Finish or shrink the two-UI period.** This is the single biggest risk
   right now: every schema change, every domain fix, has to be reasoned
   about against two UIs and one shared store. The project's own
   `REMAINING-WORK-SPEC.md` P0.2–P0.5 already targets this, and I'd treat it
   as the top priority over any new feature — the coexistence tax compounds
   the longer it lasts.
2. ~~Split the build so legacy and modern don't both ship to every user.~~
   **Checked — not actually a problem.** `vite.config.js` uses a genuine
   multi-page build (`legacy`/`modern` rollup inputs); `dist/index.html`
   loads only `legacy-*.js`/`legacy-*.css` and `dist/modern.html` loads only
   `modern-*.js`/`modern-*.css`. A first-time visitor to either URL only
   downloads that one bundle. The one real nuance: the generated service
   worker's precache manifest (`dist/sw.js`) lists _both_ bundles, so after
   the first successful load the PWA fetches both interfaces in the
   background for offline use. That's intentional, not a bug — the README
   and `REMAINING-WORK-SPEC.md` both say the legacy interface is the current
   offline fallback until the modern UI fully replaces it (P0.4/P0.5), so
   both need to work offline for now. Nothing to fix here until legacy is
   actually removed, at which point the precache shrinks automatically.
3. ~~Add a CI workflow.~~ **Done.** `.github/workflows/ci.yml` now runs
   `npm run check` (typecheck, lint, format check, unit tests, build) and a
   separate Playwright e2e job on every push to `main` and every pull
   request. Not yet pushed anywhere — there's no GitHub remote configured
   for this repo yet, so the workflow only takes effect once one exists.
4. ~~Add lint/formatting.~~ **Done.** ESLint (flat config, typescript-eslint +
   `react-hooks` + `react-refresh`) and Prettier are wired into
   `npm run lint` / `npm run format` / `npm run format:check`, and `npm run
check` now fails on either. Baseline is clean: 0 errors, 14 warnings, all
   pre-existing dead code inside the legacy `app.js` (flagged, not touched).
   One real bug surfaced and fixed along the way: `LibraryPage.tsx` rebuilt
   its `allExercises` array on every render and listed it as a `useMemo`
   dependency, silently defeating that memo's caching every time.
   Getting here needed an extra step worth flagging: this project's
   `typescript@7.0.2` (the new Go-based rewrite) no longer ships the classic
   compiler API at all, and `typescript-eslint` doesn't support TS 7 yet
   ([tracking issue](https://github.com/typescript-eslint/typescript-eslint/issues/10940)).
   Since `typescript` is a peerDependency, npm won't give the linter its own
   nested copy the normal way. `scripts/provision-lint-typescript.mjs` (run
   via `postinstall` and before `lint`) provisions a working TypeScript 5.7
   copy directly into whichever nested `node_modules` folder each
   typescript-eslint package resolves from, computed dynamically so it
   survives npm's hoisting changing between installs. This is a real
   workaround for a real ecosystem gap, not incidental complexity — remove
   it once typescript-eslint supports TS 7.
5. **`localStorage` as the only store is the nearest real scaling wall.**
   Fine today, but every write serializes the _entire_ dataset synchronously,
   and there's no IndexedDB path yet. This is explicitly deferred in the
   docs "until measured need" — reasonable, but worth instrumenting (e.g. log
   serialized size in the existing Data & Backup panel) so "measured need"
   has a trigger instead of being decided anecdotally.
6. **Validate the plan against real users before building more of it.**
   `PRODUCT_TRANSFORMATION_PLAN.md` §13 sets concrete usability targets
   (median time-to-decision under 10s, 80% comprehension, etc.) but nothing
   in the repo shows those sessions have run yet. Given the amount of
   interaction-design prescription already implemented (priority ladder,
   evidence-sufficiency labels, three-item focus cap), I'd validate that
   design with a handful of real users before sinking more phases into it —
   it's a lot of well-reasoned but still-untested product judgment.
7. **`src/app.js` at 5,232 lines is the highest-risk file in the repo** purely
   by size and by being the one file every legacy-path bug fix touches. Its
   pure-logic pieces are the best candidates to peel into
   `src/domain/*` next, both to shrink it and to get it under the same test
   discipline the new domain modules already have.
   **Started.** Body-metric, Fitatu nutrition-day, and recovery-check-in
   normalization (`normalizeBodyMetric(s)`, `normalizeNutritionDay(s)` +
   `nutritionDayFingerprint`, `normalizeRecoveryCheckin(s)`, plus the small
   `isValidDateKey`/`toDateInput`/`parseDate`/`precision` helpers they share)
   moved into the already-tested `src/domain.js`, with `app.js` now
   delegating to `Domain.*` — the exact pattern the file already used for
   `hash`/`numberOrNull`. These were genuinely pure (no DOM, no module-level
   `state`) and previously had zero direct test coverage; `test/health-records.test.js`
   adds 9 tests, taking the suite from 110 to 119, all passing. I deliberately
   did _not_ touch `migrateData()` (~280 lines, the highest-value target)
   in this pass: it's tightly coupled to the exercise catalog and several
   other app.js-local helpers, and extracting it safely needs either pulling
   those along too or a more careful seam — bigger than a first slice, and
   risky to rush given the legacy `/` UI has no automated test coverage at
   all (Playwright only exercises `/modern.html`). That's the natural next
   target, not this one.

## Bottom line

This is a well-scoped, unusually self-aware project: it knows exactly what
state it's in (a checkpoint, not a finished product), has real tests
protecting its trickiest logic (import correction, effort provenance,
migrations), and has resisted scope creep into things like AI coaching,
social features, or opaque scores. The main risk isn't the code quality —
it's the cost of running two UIs against one data model for longer than
necessary, and the fact that the product-design ambition (priority ladder,
evidence labels, decision-first Today screen) is still ahead of any real
usage evidence that it works for actual users.
