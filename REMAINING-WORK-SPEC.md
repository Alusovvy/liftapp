# Liftwise remaining-work specification

Status: implementation hand-off  
Prepared: 2026-08-03  
Primary contracts: [`PRODUCT_TRANSFORMATION_PLAN.md`](PRODUCT_TRANSFORMATION_PLAN.md) and
[`workout-optimization-featuer.md`](workout-optimization-featuer.md)

## 1. Purpose and frozen baseline

This file is the single hand-off backlog for work that remains after the current
React/TypeScript product transformation checkpoint. It does not replace the two
approved product specifications. When wording conflicts, their safety, evidence,
accessibility, data-ownership, and non-goal rules win.

The current checkpoint is deliberately launchable and useful, but it is not the
end of the migration. It contains:

- the responsive five-destination React shell and Settings & data entry;
- Today’s safety-first attention hierarchy and maximum-three focus list;
- transparent routine optimization, curated relationships, mandatory diff preview,
  immutable revisions, protect/snooze/suppress controls, and exact undo;
- workout and Fitatu CSV chooser, validation preview, explicit partial-import
  consent, commit, provenance, and exact import undo;
- an autosaved focused workout that defaults unspecified RIR to 3 and saves only
  completed sets;
- Progress views for focus, exercise evidence, muscle coverage, and recovery;
- neutral body trends and Fitatu completeness-aware summaries;
- a contextual searchable Library with persistent favorites and view preferences;
- JSON backup download and validated, previewed, explicitly confirmed restore.

The modern interface is served at `/modern.html`. Some authoring and correction
actions intentionally link to the legacy interface at `/` until their React
replacement is complete. Both interfaces use the same validated local dataset.

## 2. Launch and preservation contract

The next engineer must keep the following true after every backlog item:

1. `npm start` opens the modern interface.
2. `npm run check` and `npm run test:e2e` pass.
3. `npm run build` produces a static `dist/` build.
4. Existing `liftwise-data-v1` data opens without a manual migration.
5. A valid pre-transformation JSON backup restores without losing workouts,
   routines, body measurements, nutrition, recovery, preferences, source history,
   or optimizer revisions.
6. Invalid files never replace current data.
7. Workout drafts, imports, restores, and optimizer revisions retain a visible
   recovery or undo path where the approved specs require one.
8. No cloud account, analytics, medical diagnosis, opaque readiness score, or
   automatic plan mutation is introduced.

## 3. Priority 0 — required before the modern UI replaces legacy

### P0.1 Complete the safety gate in Optimize plan

The current Today decision blocks training generation for a reported pain concern,
but the optimizer does not yet apply the same gate.

Deliver:

- pass the relevant current recovery/pain state into the pure optimizer input;
- return no actionable proposal while the pain gate is active;
- retain a calm explanation and access to the unchanged routine;
- prevent application of a preview that became stale because the safety state
  changed.

Acceptance:

- domain, component, and Playwright tests cover pain before analysis and pain
  reported after preview;
- no apply or trial action remains available;
- wording is non-diagnostic and never advises training through pain.

### P0.2 Replace the remaining legacy authoring workflows

Build React/TypeScript flows for:

- first run and profile creation;
- routine create, edit, schedule, and delete;
- full historical manual-workout editing and safe imported-set correction;
- recovery check-in create/edit/correct;
- body-measurement create/edit/correct;
- training targets, units, locale, equipment, and profile editing.

Acceptance:

- first run → create routine → start → log → finish is entirely modern;
- a historical correction recalculates affected recommendations;
- correcting a recovery/body record preserves provenance;
- every destructive action has confirmation and a recoverable path where practical;
- no modern action depends on opening `/`.

### P0.3 Finish custom-exercise management

Deliver:

- create/edit/merge/delete custom exercises;
- aliases and import-matching controls;
- primary/secondary muscle, movement role, measurement mode, load convention,
  repetition convention, equipment, instructions, and setup metadata;
- an explicit `needs_mapping` state that excludes uncertain exercises from
  automatic optimizer proposals.

Acceptance:

- imported unknown names can be preserved without being guessed;
- a completed reviewed mapping can become optimizer-eligible;
- merging rewrites references transactionally and can be recovered from backup;
- deleting an in-use exercise is blocked or requires an explicit merge target.

### P0.4 Make the modern app the only entry and PWA shell

Deliver:

- stable direct routes or URL state for destinations and Train/Progress subtabs;
- contextual navigation, including Body → Train/Import and recommendation →
  relevant exercise/routine;
- PWA `start_url` and navigation fallback targeting the modern app;
- offline update/reload behavior verified against the modern shell;
- removal of links whose label does not match their actual destination.

Acceptance:

- `/` and an installed launch open the final modern UI;
- browser refresh preserves the current destination safely;
- “Open Fitatu import” opens Train with the Import tab selected;
- direct links work offline after the first successful load.

### P0.5 Remove the legacy UI without removing behavior

Only begin after P0.2–P0.4 pass.

Deliver:

- remove replaced DOM/render paths from `index.html`, `src/app.js`,
  `src/domain.js`, and legacy-only CSS/controllers;
- move any still-authoritative calculations behind typed domain/repository
  boundaries before deleting their old callers;
- remove duplicate calculations and stale storage writers;
- update README and functionality documentation to describe one interface.

Acceptance:

- no orphaned legacy link, modal, event handler, or storage writer remains;
- characterization fixtures produce the approved outputs;
- production contains one app shell and one authoritative calculation path;
- the legacy removal is a separate, revertible Git commit.

### P0.6 Final storage and recovery rehearsal

Deliver:

- versioned migration tests from representative legacy stores;
- browser-level backup → clear test origin → restore → exact important-data check;
- a pre-restore local snapshot with one-click undo, or an equally explicit
  documented recovery mechanism;
- corrupt-storage, quota failure, interrupted write, and stale-tab handling.

Acceptance:

- failures leave the last valid dataset intact;
- restore includes optimizer preferences/revisions and any trial state;
- two tabs cannot silently overwrite newer data;
- the pre-transformation fixture and current fixture both pass.

## 4. Priority 1 — complete the approved product experience

### P1.1 Train completion and history depth

- Add the specified completion debrief: completed work, meaningful changes from the
  comparable prior session, plan adjustments, and one calm next action.
- Add modern history search/filter/detail and editing parity.
- Connect Today’s “review workout” and related actions to the exact modern record.
- Preserve the rule that only checked/completed sets enter history.

Acceptance is covered by mobile, keyboard-only, sparse-history, imported-history,
and correction-updates-recommendation journeys.

### P1.2 Progress visual and recovery depth

- Add the body map only as secondary navigation; keep ranked text as the primary
  quantitative muscle view.
- Add accessible target bands and compact trends with text/table equivalents.
- Show recovery inputs and transparent session adjustments together without causal
  claims.
- Add check-in correction from this context.

Every visual must remain understandable without color and expose raw comparable
records.

### P1.3 Body & nutrition depth

- Add small accessible SVG trend charts with point values and a table fallback.
- Keep the existing sufficiency rule: no directional claim before three points
  spanning at least fourteen days.
- Keep missing Fitatu days excluded rather than treated as zero.
- Add measurement management in the modern UI and direct Fitatu import navigation.
- Preserve likely-entry-error flags as review prompts; never silently delete or
  “correct” the value.

### P1.4 Library details and contextual selection

- Add exercise detail: purpose, setup, equipment, measurement convention,
  direct/secondary targets, recent use, routines using it, and reviewed alternatives.
- Deep-link optimizer and progress evidence to the relevant detail.
- Explain why an exercise is familiar, available, unavailable, or being suggested.
- Retain search/filter state when returning from detail.

### P1.5 Finish optimizer phases

The current checkpoint implements the read-only audit, reviewed preview/apply,
immutable revisions, exact undo, and limited direct-vs-secondary time-saving
trade-offs. Remaining optimizer work:

- controlled three-exposure variation trials with an immutable baseline;
- keep/revert review with no preselected outcome;
- within-exercise progress handling without comparing raw loads across exercises;
- safety-state invalidation and routine-revision concurrency throughout the flow;
- custom-exercise advanced mapping;
- professionally reviewed expansion of the relationship graph;
- “edit proposal” beyond changing set counts where safe;
- usability evaluation before enabling additional relationships.

Acceptance:

- original routine is always recoverable;
- a trial never changes the plan automatically;
- custom exercises are never guessed into equivalence;
- no proposal uses “same effect”, “equivalent”, or an unqualified “optimal” claim;
- protected exercises, equipment, direct work loss, weekly frequency, and the
  four-set automatic consolidation guardrail remain enforced.

## 5. Priority 2 — release hardening and evidence

### P2.1 Complete automated journeys

Add or retain Playwright coverage for:

1. first run → routine → workout → finish;
2. recovery caution → reduced workout;
3. pain response → generation and optimizer apply blocked;
4. workout import → preview → confirm → undo;
5. Fitatu import → preview → confirm → completeness;
6. historical edit → recommendation update;
7. backup → destructive change → restore;
8. install/offline reload → record → reload with data intact;
9. complete a workout at 320 CSS pixels without page overflow;
10. keyboard-only workout and both import flows;
11. optimizer apply/undo, stale preview, protect, trial keep/revert, and restore;
12. long Polish/English content and large text.

### P2.2 Accessibility acceptance

- Run axe on every major empty, normal, caution, pain, error, dialog, and restored
  state.
- Manually review with keyboard, at least one desktop screen reader and one mobile
  screen reader, 200% and 400% zoom, forced colors/high contrast, and reduced motion.
- Verify focus entry/return for dialogs, imports, restore, and optimizer preview.
- Verify status announcements do not interrupt set entry.
- Meet WCAG 2.2 AA; record defects and retest evidence.

### P2.3 Visual, responsive, browser, and device verification

- Add approved visual-regression references for Today, pain/caution, live workout,
  sparse Progress, Fitatu, import preview, and long/large text.
- Test 320, 375, 768, 1024, and 1440 CSS-pixel widths.
- Agree and document the browser/device support matrix, then run it.
- Prevent horizontal page scrolling except a truly tabular region with an
  accessible linear alternative.

### P2.4 Engineering quality gates

- Introduce lint and formatting checks without mass-changing unrelated legacy code.
- Keep risk-heavy domain modules above 90% branch coverage.
- Run typecheck, lint/format, unit/component, accessibility, E2E, production build,
  backup compatibility, and storage migration checks in CI.
- Add dependency/licence review and reproducible install verification.
- Keep phase-scoped, revertible commits and a tested rollback point.

### P2.5 Performance and PWA audit

- Measure rather than guess: startup, interaction latency, bundle, long history,
  large imports, and storage writes.
- Audit installability, offline navigation, update prompting, cache invalidation,
  and data persistence.
- Optimize only measured bottlenecks; do not add a state or chart library without
  a demonstrated need.
- Record target devices, datasets, measurements, and results.

### P2.6 Documentation and user validation

- Update `FUNCTIONALITY.md` after each completed migration slice.
- Document the final data schema, import formats, provenance, recovery paths,
  optimizer taxonomy/version, and known health-product limits.
- Run the formative comprehension/usability sessions specified in both approved
  plans, including assistive-technology participants where possible.
- Validate that users can explain action/reason/evidence, direct versus secondary
  work, “similar planned role” versus “same effect”, Keep current, preview, and undo.
- Do not optimize acceptance rate, novelty, time in app, streak pressure, or a
  synthetic optimization score.

## 6. Deferred integrations and explicit non-goals

These are not required to finish the approved local product transformation:

- Garmin account sync until approved API access and a secure server-side OAuth/token
  service exist;
- cloud accounts, social/community features, remote analytics, ads, or data sale;
- diagnosis, injury treatment, individualized medical nutrition, or claims of
  physiological equivalence;
- an AI-generated or automatically expanding exercise-relationship graph;
- automatic routine mutation;
- calorie, weight, or recovery moralizing;
- strength-sport peaking, endurance programming, or fully automated periodization.

Any proposal to add one of these needs a new approved specification, privacy review,
threat model, and separate rollout plan.

## 7. Definition of transformation complete

The transformation is complete only when:

- all P0 items and the chosen P1 scope are implemented or explicitly removed from
  the approved product scope;
- the final UI has no legacy dependency;
- critical P2 journeys and accessibility checks pass;
- a pre-transformation backup restores correctly;
- offline install/reload and local persistence are verified;
- documentation describes the shipped product, not a mixed transitional state;
- a final tagged Git checkpoint can be built and launched with the commands in the
  README.
