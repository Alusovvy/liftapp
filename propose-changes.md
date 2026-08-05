# Proposed changes for Liftwise

Status: **approved and implemented on 2026-07-29**, with the explicitly recommended deferrals noted below.

The detailed proposal is retained as the audit/design record. Its “current problem” sections describe the pre-implementation baseline, not the current application. The authoritative current behavior is documented in `FUNCTIONALITY.md`.

This document is based on:

- A complete read of `FUNCTIONALITY.md`.
- Source review of `app.js`, `index.html`, and `styles.css`.
- Browser inspection of all five application views and the workout editor at desktop size.
- Browser checks of RIR editing and repeat CSV import behavior.
- Review of storage, migration, validation, calculation, and rendering paths.

The goal is to distinguish correctness work from optional product expansion. The proposals are deliberately separable so they can be approved, rejected, or deferred by ID.

## Implementation result

| ID  | Result                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Implemented: source identity, content fingerprint, correction upsert, unchanged skip, manual-RIR overlay, and conflicts for unmatched manual sets                                                                                                        |
| C2  | Implemented: explicit effort provenance, dirty-only RIR saving, intentional clear state, and labelled derived/manual effort                                                                                                                              |
| C3  | Implemented: file/row limits, range validation, rejected-row reasons, report download, and explicit partial-import approval                                                                                                                              |
| C4  | Implemented: pre-migration recovery snapshot, validation, render-before-commit, and corrupt-data recovery UI                                                                                                                                             |
| C5  | Implemented: Data & Backup center, persistence/size/count/backup/import status, and large-operation safeguards                                                                                                                                           |
| F1  | Implemented incrementally: Vite module/build structure, pure `src/domain.js`, isolated `src/ui/import-chooser.js`, and Vitest domain/component/jsdom integration coverage; the remaining browser controllers stay in `src/app.js` for gradual extraction |
| W1  | Implemented: debounced drafts, reload resume/discard, close warning, and unload protection                                                                                                                                                               |
| W2  | Implemented: repeat without effort, saved routines, weekday assignment, start/delete actions                                                                                                                                                             |
| W3  | Implemented: load+reps, reps-only, duration, and distance+duration manual set modes                                                                                                                                                                      |
| W4  | Implemented: explicit total/per-hand/added-bodyweight/assistance/no-load and total/per-side conventions                                                                                                                                                  |
| W5  | Implemented: change preview, bounded import history, conflict counts, persistent result, and one-step undo                                                                                                                                               |
| W6  | Implemented: source sessions remain distinct; same-day exercise aggregation is derived for display                                                                                                                                                       |
| W7  | Implemented: missing-only filter, keyboard navigation, apply-below, and dirty-only writes                                                                                                                                                                |
| W8  | Implemented: session/exercise search, source/date/RIR filters, pagination, state retention, and earliest-week stop                                                                                                                                       |
| W9  | Implemented: a scheduled routine becomes the next-session base; coverage work is an optional adjustment                                                                                                                                                  |
| A1  | Implemented: larger critical text/targets, improved contrast, keyboard chart/map access, focus handling, and 320 px reflow                                                                                                                               |
| I1  | Implemented: exercise charts, text tables, records, PR markers, and set-type filter                                                                                                                                                                      |
| I2  | Implemented: muscle-status analysis moved from Body metrics to Coach insights                                                                                                                                                                            |
| I3  | Implemented: muscle/equipment/availability/favorite/sort/density filters and custom-exercise mapping/merge management                                                                                                                                    |
| I4  | Implemented: body-metric editing, same-day replace confirmation, conditions, chart windows, and useful comparisons                                                                                                                                       |
| I5  | Implemented: 30-day recovery history and workout recovery snapshots/context                                                                                                                                                                              |
| P1  | Selective rendering and bounded pagination implemented; IndexedDB remains intentionally deferred until measured need                                                                                                                                     |
| P2  | Implemented: web manifest, icon, service worker, offline shell, and update/cache status                                                                                                                                                                  |
| P3  | Implemented for units and primary interface: kg/lb conversion plus English/Polish navigation/headings/actions; full detailed-copy translation remains deferred                                                                                           |
| P4  | Implemented as the recommended demotion: Garmin is a Data & Backup roadmap detail, not a prominent functional card                                                                                                                                       |

Also completed during acceptance:

- The supplied `workout_data.csv` was parsed in-browser: 47 workouts, 1,129 sets, and 44 exercise names with all mappings resolved.
- Its latest-seven-day scope contains 4 workouts and 85 sets.
- Browser regression checks cover corrected import plus manual RIR preservation, unchanged import, validation, recent scope, manual timed sets, and 320 px layout.

## 1. How to review this proposal

Suggested response format:

```text
Approve: C1, C2, C3, F1, W1
Defer: W3, I2
Reject: P4
Questions: C1, W5
```

Priority meanings:

| Priority | Meaning                                                                         |
| -------- | ------------------------------------------------------------------------------- |
| P0       | Data correctness, recoverability, or behavior that currently contradicts the UI |
| P1       | High-value workflow and usability improvement                                   |
| P2       | Valuable enhancement after the core is reliable                                 |
| P3       | Optional expansion or strategic decision                                        |

Effort estimates are relative:

| Size | Meaning                                           |
| ---- | ------------------------------------------------- |
| S    | Localized change                                  |
| M    | Several related components or one schema change   |
| L    | Cross-cutting feature or substantial UI/data work |
| XL   | Architectural or product-scope project            |

## 2. Current strengths worth preserving

The audit found a strong base that should not be lost during rework:

- Local-first operation with no required account.
- Complete JSON backup alongside Hevy-compatible CSV interchange.
- Explainable coaching rules with visible inputs and `WHY` text.
- Conservative recovery and pain guardrails.
- Individual-set storage, including warm-up/drop-set distinctions.
- Date-scoped Hevy preview, mapping, and recent-week import.
- Manual RIR editing on imported workouts.
- Equipment-aware exercise selection.
- Explicit primary/secondary muscle credit.
- Good responsive structure and generally polished visual hierarchy.
- Escaped user content and rollback behavior for most failed writes.

The proposed changes should preserve these properties unless an approved proposal explicitly replaces one.

## 3. Audit findings that need decisions

### Confirmed correctness findings

1. **A corrected Hevy workout is skipped.** Import identity is based on start time and title. Re-importing the same workout after correcting its load, reps, notes, or exercises in Hevy is treated as a duplicate and skipped. This conflicts with the current instruction to “correct it in the source and re-import.”
2. **RIR editing marks untouched sets as manual.** Saving the RIR editor writes `rirManual: true` to every displayed set, including untouched blank values and RIR merely derived from imported RPE.
3. **Imported effort can become internally contradictory.** A set can retain imported `RPE 8` while receiving manual `RIR 1`; both are displayed/exported even though they represent different effort values.
4. **CSV values are not fully validated before storage.** Negative load/repetition values, out-of-range RPE/RIR, future dates, and extreme durations can enter through CSV even though manual input and JSON restore reject comparable values.
5. **Automatic migration overwrites the stored copy.** Data is migrated and immediately written back during load. There is no retained pre-migration snapshot if a future migration contains a defect.

### Product and workflow findings

1. The manual editor cannot log duration- or distance-based sets even though the data model and catalog include them.
2. Load semantics are ambiguous for dumbbells, unilateral exercises, weighted bodyweight work, and assisted movements.
3. The generated “Next session” contains at most two movements and is closer to a priority add-on than a complete routine.
4. User-selected import mappings are not remembered as persistent aliases for later files.
5. Daily merge achieves one exercise entry per day by destructively collapsing separate same-day sessions, which changes session count and session-level history.
6. Custom exercises have no management/mapping interface.
7. Long workout entry has no draft recovery or unsaved-change warning.
8. Workouts cannot be searched by session or exercise, and historical-week navigation can continue indefinitely into empty weeks.
9. The Body metrics view mixes body-composition tracking with a large training-status feature, making the information architecture less clear.
10. Many labels use 8–10 px text, and several low-contrast metadata elements are difficult to read.

### Engineering findings

- `app.js` is one 3,191-line global script containing storage, migration, import parsing, calculations, and every UI controller.
- There is no automated test suite checked into the project.
- Most mutations call `renderAll()`, rebuilding hidden views as well as the visible view.
- The whole dataset is synchronously parsed/stringified through one `localStorage` value.
- The documented restore limit of 10,000 workouts is far above the practical rendering and browser-storage design.
- Import batches and historical recovery records are stored but have little or no management UI.

## 4. Recommended order

The recommended sequence is:

1. **Correctness foundation:** C1–C5 and F1.
2. **Daily logging quality:** W1, W2, W3, W4, W7.
3. **Import/history clarity:** W5, W6, W8.
4. **Coaching and information architecture:** W9, A1, I1–I3.
5. **Platform expansion:** P1–P4 only after real usage demonstrates the need.

No large feature should be built before C1–C5 have regression coverage.

## 5. Summary decision table

| ID  | Proposal                                                              | Priority | Size | Recommendation                |
| --- | --------------------------------------------------------------------- | -------: | ---: | ----------------------------- |
| C1  | Upsert corrected Hevy workouts instead of blindly skipping them       |       P0 |    L | Approve                       |
| C2  | Rework effort provenance and update only touched RIR fields           |       P0 |    M | Approve                       |
| C3  | Add strict CSV validation and rejected-row reporting                  |       P0 |    M | Approve                       |
| C4  | Add recoverable, transactional data migrations                        |       P0 |    M | Approve                       |
| C5  | Add storage-health and backup safeguards                              |       P0 |    M | Approve                       |
| F1  | Extract a tested domain core and add regression fixtures              |       P0 |    L | Approve                       |
| W1  | Autosave workout drafts and warn before discarding edits              |       P1 |    M | Approve                       |
| W2  | Add repeat-workout and reusable routine templates                     |       P1 |    L | Approve                       |
| W3  | Support reps, duration, and distance set modes                        |       P1 |    L | Approve                       |
| W4  | Define load/repetition conventions for unilateral and bodyweight work |       P1 |    L | Approve after design choice   |
| W5  | Add import history, conflict preview, and import undo                 |       P1 |    L | Approve after C1              |
| W6  | Preserve source sessions while keeping daily exercise aggregation     |       P1 |   XL | Approve concept; design first |
| W7  | Improve high-volume RIR entry                                         |       P1 |    M | Approve after C2              |
| W8  | Add workout search, exercise/date filters, and useful week navigation |       P1 |    M | Approve                       |
| W9  | Reframe or integrate the generated next session with real routines    |       P1 |    L | Approve after W2              |
| A1  | Improve text size, contrast, targets, and chart keyboard access       |       P1 |    M | Approve                       |
| I1  | Add exercise progress charts and record history                       |       P2 |    L | Approve                       |
| I2  | Separate training-status analysis from Body metrics                   |       P2 |    M | Approve                       |
| I3  | Rework library discovery and custom-exercise management               |       P2 |    L | Approve                       |
| I4  | Improve body-metric editing and trend comparisons                     |       P2 |    M | Consider                      |
| I5  | Make recovery history useful instead of stored-only data              |       P2 |    M | Consider                      |
| P1  | Move large datasets to IndexedDB and render views selectively         |       P2 |   XL | Defer until needed            |
| P2  | Add installable offline/PWA support                                   |       P2 |    M | Consider                      |
| P3  | Add localization and display-unit preferences                         |       P2 |    L | Consider                      |
| P4  | Decide whether Garmin is a real roadmap item or should be demoted     |       P3 | XL/S | Decide explicitly             |

## 6. Correctness and data-integrity proposals

### C1. Upsert corrected Hevy workouts

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P0  
Size: L

#### Current problem

The deterministic Hevy source key uses workout start time plus title. `commitCsvImport()` skips any existing workout with the same source identity before comparing content.

Consequences:

- A corrected weight or repetition count in Hevy does not update Liftwise.
- A newly added exercise in the same Hevy workout does not appear.
- Corrected notes or set types do not appear.
- The UI tells users to correct imported data in the source and re-import, but that flow does not work.
- The only current workaround is a replacement import, which may remove local/manual history outside the file.

This behavior was reproduced in-browser: a workout imported with 50 kg remained at 50 kg after re-importing the same title/start with 55 kg.

#### Proposed behavior

Separate source identity from content identity:

- `sourceIdentity`: provider + provider workout ID when available; otherwise start timestamp + title.
- `contentFingerprint`: normalized workout content excluding local overrides.
- Unchanged identity + unchanged fingerprint: skip.
- Unchanged identity + changed fingerprint: update/upsert after showing a change summary.
- New identity: add normally.

Imported fields should be treated as a replaceable source snapshot. Manual fields should be treated as an overlay.

For sets, preserve manual RIR using a stable source-set identity where possible:

```text
provider workout identity + canonical exercise + source set index
```

If a changed source set no longer matches safely, show a conflict rather than silently appending or deleting it.

#### Acceptance criteria

- Re-importing an unchanged file makes no data changes.
- Correcting load/reps/type/notes in Hevy updates the existing imported workout.
- Adding or removing a source set produces a visible preview and deterministic result.
- Manual RIR survives updates to the underlying imported set.
- No duplicate workout or exercise entry is created.
- The import result reports added, updated, unchanged, conflicted, and skipped counts separately.
- Existing schema-7 imports migrate without losing source keys or RIR.

#### Risks and dependencies

- Depends on C2 for a reliable manual-effort overlay.
- Source exports without provider IDs require a fallback identity and conflict rules.
- Removing source sets needs a product decision: mirror source deletion, retain locally, or prompt.

### C2. Rework effort provenance and dirty-field saving

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P0  
Size: M

#### Current problem

`saveWorkoutRir()` saves every input and marks every set `rirManual: true`, not only changed inputs.

Example observed during the audit:

- Set 1 had imported `RPE 8`, producing estimated `RIR 2`.
- Set 2 was manually changed to `RIR 1.5`.
- Set 3 remained blank.
- Saving marked all three sets as manual.

A second issue is provenance ambiguity:

- Derived RIR looks like measured/manual RIR.
- Manual RIR can conflict with retained imported RPE.
- Export can emit both values without explaining which one is authoritative.

#### Proposed behavior

Use explicit effort provenance:

```text
rawRpe
explicitImportedRir
manualRir
effectiveRir
effortSource = manual | imported-rir | derived-from-rpe | missing
```

Only fields actually touched by the user should become manual overrides. An intentionally cleared field needs its own override state, distinct from untouched.

Display rules:

- `2 RIR (estimated from RPE 8)` for derived effort.
- `1 RIR (manual override)` when locally entered.
- Preserve raw imported RPE for audit/export without presenting conflicting values as equally authoritative.
- If manual RIR and imported RPE disagree, show the manual value as effective and label the source value as original import metadata.

#### Acceptance criteria

- Changing one RIR changes only that set.
- Untouched derived/blank sets retain their previous provenance.
- Clearing one RIR remains cleared after reload and re-import.
- Derived RIR is visibly labelled as estimated.
- Manual RIR is visibly labelled as manual where provenance matters.
- Export has a documented policy for raw RPE versus effective/manual RIR.
- Migration assigns sensible provenance to existing schema-7 data.

#### Risks and dependencies

- Requires schema version 8 or an equivalent migration.
- C1 should use this overlay rather than merging effort directly into source values.

### C3. Strict CSV validation and rejected-row reporting

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P0  
Size: M

#### Current problem

Manual workout entry and JSON restore validate ranges, but CSV parsing largely normalizes numbers without rejecting invalid ones.

Potential imported values include:

- Future workout dates.
- Negative loads or repetitions.
- RPE/RIR outside 0–10.
- Extreme workout durations.
- Negative distance or set duration.
- Very large files/row counts that can freeze the main thread.

Rows missing an exercise or parseable start date are silently ignored, so the preview does not explain what was dropped.

#### Proposed behavior

Add a two-stage import validator:

1. **File-level validation**
   - Maximum file size.
   - Maximum row count.
   - Required headers.
   - Consistent parse completion.
2. **Row/workout validation**
   - Valid non-future local date, or an explicit opt-in for planned/future workouts.
   - Load 0–2,000 kg.
   - Repetitions 0–100 for imported data.
   - RIR/RPE 0–10.
   - Non-negative distance/duration within backup limits.
   - Workout duration 0–1,440 minutes.

The preview should report:

- Accepted rows.
- Rejected rows.
- Rows accepted with conversion/warning.
- Rejection reasons and source row numbers.

Offer:

- **Cancel import**
- **Import valid rows only**
- Optional downloadable error report

Do not silently coerce structurally invalid training data.

#### Acceptance criteria

- Invalid numeric values cannot enter persisted workout data.
- Future dates are rejected or explicitly approved.
- Every dropped row is counted and explained.
- Oversized input is rejected before expensive rendering.
- A partially valid import requires explicit confirmation.
- Existing valid Hevy and Liftwise CSV exports still import successfully.

### C4. Transactional and recoverable migrations

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P0  
Size: M

#### Current problem

On load, valid stored data is migrated and immediately written over the previous value. A defective future migration could permanently replace the only browser copy before the user can export it.

Malformed JSON falls back to demo data with only a console warning; the user receives no recovery UI for the raw stored payload.

#### Proposed behavior

Before migrating:

- Retain the previous payload under a bounded recovery key such as `liftwise-data-recovery-v7`.
- Run migration on a clone.
- Validate the migrated result with the same structural validator used for backup restore.
- Persist only after validation and a successful render smoke check.
- Retain one previous-version snapshot until the next confirmed successful write.

If load fails:

- Do not silently present demo data as though it were the user's data.
- Show a recovery screen with:
  - Retry
  - Download raw recovery data
  - Restore previous snapshot
  - Start fresh only after confirmation

#### Acceptance criteria

- A failed migration leaves the previous payload recoverable.
- A corrupt primary key does not erase/download-overwrite the raw value.
- Recovery data is bounded and does not grow indefinitely.
- Successful migration is covered by version-to-version fixtures.

### C5. Storage health and backup safeguards

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P0  
Size: M

#### Current problem

The app promises large restore limits but stores the complete dataset in one synchronous `localStorage` item. Practical browser quota is much lower and varies by browser/profile.

Users do not see:

- Approximate storage usage.
- Last successful backup date.
- Whether persistence is unavailable/private/blocked.
- A warning before a large replace import.

#### Proposed behavior

Add a Data & Backup panel showing:

- Stored workout/set count.
- Approximate serialized size.
- Last successful JSON backup timestamp.
- Last import summary.
- Storage availability/health.

Add prompts:

- Recommend backup before replace import or large merge.
- Warn at configurable size thresholds.
- Offer a post-import backup.
- Make “running without persistent storage” a visible blocking warning rather than console-only.

#### Acceptance criteria

- Users can tell whether data is actually persisting.
- Replace import clearly states what will and will not be deleted.
- Backup status is visible without opening developer tools.
- No backup reminder blocks routine logging.

## 7. Engineering foundation

### F1. Extract a tested domain core

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P0  
Size: L

#### Current problem

Import parsing, migration, calculations, persistence, and rendering live in one global script. This makes changes to merge/progression logic risky and prevents focused regression testing.

There is no checked-in automated test suite despite complex data rules.

#### Proposed structure

Keep the app dependency-light, but split by responsibility:

```text
src/
  catalog/
    exercises.js
    aliases.js
  domain/
    sets.js
    workouts.js
    effort.js
    progression.js
    muscle-coverage.js
    recovery.js
  import/
    csv-parser.js
    hevy-normalizer.js
    merge.js
  storage/
    schema.js
    migrations.js
    repository.js
  ui/
    dashboard.js
    workouts.js
    body.js
    library.js
```

Pure functions should not read the DOM or global state. UI controllers should consume explicit state and domain results.

Minimum automated coverage:

- CSV quoted fields, date parsing, unit conversion, and invalid rows.
- All 88 current aliases and all built-in exercises.
- Entire-file versus latest-seven-days scope.
- Unchanged, corrected, and conflicting re-imports.
- Same-day manual/Hevy merge.
- Manual RIR preservation and clearing.
- Every progression decision branch.
- Recovery thresholds.
- Muscle-map green/yellow/red boundaries.
- Schema migrations and corrupt-data recovery.
- JSON restore limits.
- CSV export round-trip.

Use anonymized/minimal fixtures rather than depending on a personal export path.

#### Acceptance criteria

- Domain tests run with one documented command.
- Merge and migration changes cannot be shipped with failing tests.
- The static deployment remains simple.
- The browser build has no implicit global dependencies between domain modules.

#### Tradeoff

This has limited immediate UI impact but lowers the risk of every later proposal. It should be done incrementally, starting with import/effort logic rather than rewriting the entire UI at once.

## 8. Logging and workout workflow proposals

### W1. Workout drafts and unsaved-change protection

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P1  
Size: M

#### Current problem

The workout dialog closes on its close button, Escape, or backdrop click. A long manually entered workout is lost without warning. There is no draft recovery after accidental navigation or tab closure.

#### Proposed behavior

- Mark the editor dirty after the first user change.
- Warn before close/backdrop/Escape when unsaved changes exist.
- Save one local draft after debounced changes.
- On reopening, offer **Resume draft** or **Discard draft**.
- Clear the draft only after a successful workout save or explicit discard.
- Store whether the draft originated from a generated session, copied workout, or blank entry.

#### Acceptance criteria

- An accidental close cannot silently discard a changed workout.
- A draft survives reload/browser restart.
- An invalid draft never overwrites a saved workout.
- Draft storage is bounded to one or a small explicit list.

### W2. Repeat workout and routine templates

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P1  
Size: L

#### Current problem

Users must rebuild recurring sessions exercise by exercise. The generated workout can prefill movements, but a real prior workout cannot be repeated directly.

#### Proposed behavior

Add:

- **Repeat this workout** in workout details.
- **Save as routine** for a manual or imported workout structure.
- Routine list with name, ordered exercises, target set counts, optional target rep ranges/RIR, and notes.
- Start routine with today's date and history-aware load/repetition templates.
- Optional weekly routine assignment without enforcing a calendar.

Copy structure and targets, not completed RIR or notes describing a past performance.

#### Acceptance criteria

- Repeating never edits the original workout.
- Completed RIR is blank in the new workout.
- Exercise order and set count are retained.
- Latest progression suggestions can update loads/reps.
- Unavailable exercises are flagged with substitution options rather than silently removed.

### W3. Repetition, duration, and distance set modes

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P1  
Size: L

#### Current problem

The data model imports duration and distance, and the catalog calls Plank timed, but the manual editor requires repetitions for every set. Timed holds, carries, running, rowing, and similar sets cannot be represented faithfully.

#### Proposed behavior

Give each exercise a default measurement mode:

- `load_reps`
- `reps`
- `duration`
- `distance_duration`

Allow a per-set override where useful.

Qualified-set logic should become mode-aware:

- Rep set: repetitions ≥ 1.
- Duration set: duration > 0.
- Distance set: distance > 0, optionally duration > 0.

Progression should use mode-specific comparisons:

- Duration at same load.
- Distance at same load/time.
- Pace only when both distance and duration exist.

Muscle coverage can still credit a completed non-warm-up set, but the UI must explain that duration/distance sets are counted as sets without pretending their difficulty is equivalent.

#### Acceptance criteria

- Plank can be logged as seconds without fake repetitions.
- Imported timed/distance sets can be manually recreated.
- Existing repetition workouts are unchanged.
- CSV round-trip preserves the selected measurement data.
- Progression never compares incompatible measurement modes.

### W4. Explicit load and side conventions

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P1  
Size: L

#### Current problem

`weightKg` has no convention. It can mean:

- One dumbbell.
- Total of two dumbbells.
- Total barbell load.
- Added weight on a pull-up/dip.
- Assistance on a machine/band.

Repetitions are also ambiguous for unilateral work: per side versus total.

This makes load volume and progression comparisons unreliable when a user's convention changes.

#### Proposed behavior

Store exercise-level defaults:

```text
loadMode = total | per_hand | added_bodyweight | assistance | none
repMode = total | per_side
```

Display the convention beside the field and keep it stable in history.

Calculation policy:

- Progression compares the logged convention consistently.
- Volume can normalize `per_hand` to total when two implements are used.
- Assistance decreases should be treated as progress, unlike external load increases.
- Added-bodyweight performance should not pretend external load is total system load unless body weight is available and explicitly included.

#### Acceptance criteria

- Dumbbell and unilateral conventions are visible during entry and history.
- Changing a convention does not silently rewrite old logs.
- Assisted pull-ups do not receive backwards load advice.
- Export documents the convention or preserves it in JSON when CSV cannot.

#### Design decision required

Choose whether conventions belong to:

- The built-in exercise definition.
- The user's exercise preference.
- Each set.

Recommendation: built-in default plus user override stored from an effective date.

### W5. Import center with change preview and undo

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P1  
Size: L

Depends on: C1, C2, C3

#### Current problem

Import batches are stored but not exposed. A successful merge cannot be undone. The preview shows counts/mappings but not which existing days or sets will change.

#### Proposed behavior

Add an Import Center:

- Import history with timestamp, file, scope, and result counts.
- Pre-commit diff grouped by date:
  - New workout/day
  - Updated source workout
  - Unchanged duplicate
  - Exercise mapping change
  - Set conflict
- Post-import **Undo this import**.
- Downloadable import report.

Undo should be based on a bounded pre-import transaction snapshot or reversible change log, not on deleting every workout that contains a batch ID.

#### Acceptance criteria

- Users know which days will be affected before committing.
- Undo restores merged manual records exactly, including notes and RIR.
- Import history cannot grow without bound.
- Replace and merge have visibly different consequences.

### W6. Preserve source sessions inside daily aggregation

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P1  
Size: XL

#### Current problem

The requested daily merge prevents duplicate exercises per day, but currently does so by collapsing multiple same-day sessions into one workout record.

Side effects:

- Two real sessions count as one session in training rhythm.
- Session duration can become a sum of unrelated workouts.
- One surviving name represents several source sessions.
- Deleting the daily record deletes every merged source session.
- Exercise history cannot show which same-day session contained a set.

#### Proposed model

Preserve raw sessions and create a derived daily aggregate:

```text
day
  sourceSessions[]
  dailyExerciseAggregate[]
```

Use the daily aggregate for:

- One exercise row per day.
- Muscle coverage.
- Duplicate-set protection.
- Day-level workout summary.

Use source sessions for:

- True session count/rhythm.
- Original name, duration, notes, start/end.
- Deletion and source re-import.
- Detailed history provenance.

The UI can present one day card with expandable sessions, satisfying the existing “concrete day” goal without destroying session identity.

#### Acceptance criteria

- No duplicate exercise row appears in the daily aggregate.
- Two genuine same-day sessions still count as two sessions.
- Every set identifies its source session/manual origin.
- Re-import can update one source session without replacing the whole day.
- Deleting one source session recalculates the daily aggregate.

#### Tradeoff

This is a substantial schema and UI change. It should be designed with C1 before implementation; a smaller alternative is to keep the current record but store immutable `segments[]`.

### W7. Faster RIR entry

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P1  
Size: M

Depends on: C2

#### Proposed behavior

For workout-detail RIR editing:

- **Only missing RIR** filter.
- **Apply to remaining sets** or copy-down.
- Arrow/Tab keyboard flow with reliable focus.
- Optional per-exercise bulk value.
- Clear/manual/estimated provenance indicator.
- Sticky Save/Cancel controls for long workouts.
- Save only dirty inputs.

Do not auto-fill RIR as completed data merely because a target existed.

#### Acceptance criteria

- A 20-set imported workout can be completed without repeated pointer use.
- Bulk changes are previewable and reversible before save.
- Untouched sets remain untouched.
- Mobile numeric entry remains usable.

### W8. Workout search and historical navigation

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P1  
Size: M

#### Proposed behavior

Add workout filters for:

- Session name.
- Exercise name.
- Date range.
- Source: manual/imported.
- Missing RIR.

Add:

- Month/calendar grouping or date headings.
- Jump to earliest/latest recorded week.
- Disable previous-week navigation once the selected range is earlier than all data, or provide a date picker.
- Preserve active filter/view in the URL or session state.

#### Acceptance criteria

- A workout can be found by any contained exercise.
- Filter state is clear and resettable.
- Empty historical navigation does not continue indefinitely.
- Mobile filtering does not consume most of the viewport.

### W9. Reframe “Next session” or integrate it with routines

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P1  
Size: L

#### Current problem

The generated plan chooses at most two movements based on muscle gaps. For many users this is not a complete training session, yet the UI presents it as “Next session.”

It also does not know:

- The user's actual split.
- Planned exercises later in the week.
- Exercises intentionally excluded.
- Session time budget.
- Current routine phase.

#### Options

**Option A — Reframe**

Rename it to **Priority work for your next session** and make clear it is an add-on suggestion, not a full routine.

**Option B — Routine-aware coaching**

Use W2 routines as the base session, then:

- Suggest small set/exercise adjustments inside that routine.
- Show which weekly gap each adjustment addresses.
- Respect time budget and scheduled session type.

Recommendation: implement Option A first; adopt Option B only after routines exist.

#### Acceptance criteria

- The UI never implies two exercises are a complete program unless configured that way.
- Suggestions do not silently replace a user's routine.
- Generated adjustments remain capped and explainable.

## 9. Accessibility and interface proposals

### A1. Readability and interaction-target audit

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P1  
Size: M

#### Current problem

The interface uses many 8–10 px labels and muted low-contrast metadata. Delete controls and some icon buttons are below a comfortable touch-target size. Chart details rely partly on hover.

#### Proposed behavior

- Raise essential metadata to at least 12 px; reserve smaller mono text for nonessential decoration.
- Recheck text/background contrast in all normal, warning, disabled, and animation states.
- Use at least 40–44 px touch targets for destructive/icon controls on mobile.
- Give every hover tooltip an equivalent focus/tap behavior.
- Add visible text or tooltips for symbolic navigation icons.
- Test at 200% zoom and 320 px width.
- Keep focus trapped/restored correctly in nested workout/history dialogs.
- Announce import result summaries persistently, not only in a 2.6-second toast.

#### Acceptance criteria

- Core workflows are usable without hover.
- No essential information requires text below the agreed minimum.
- Keyboard-only users can read daily chart values and complete all forms.
- Focus is not lost when switching between workout and exercise-history dialogs.

## 10. Insight and information-architecture proposals

### I1. Exercise progress charts and personal records

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P2  
Size: L

#### Proposed behavior

Extend exercise history with:

- Top-set load/reps timeline.
- Estimated top-set score/e1RM-style trend, clearly labelled as an estimate.
- Best load at a selected repetition count.
- Working-set volume and RIR trend.
- Personal-record markers.
- Filters for normal sets versus drop sets.

Do not compare incompatible load modes from W4 or measurement modes from W3.

#### Acceptance criteria

- Every chart has a table/text equivalent.
- Bodyweight, assistance, duration, and distance exercises use appropriate metrics.
- Estimated values are never labelled as measured strength.

### I2. Separate training status from body composition

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P2  
Size: M

#### Current problem

Body metrics currently combines weight/body-fat tracking, protein context, Garmin setup, and the largest training-analysis feature: the muscle-status map.

#### Proposed behavior

Move the training-status map to:

- Coach insights, or
- A dedicated **Muscle status** subview.

Keep Body metrics focused on:

- Measurements.
- Trends.
- Measurement context.
- Optional integrations.

This reduces page length and clarifies that the colored body map reflects training evidence, not body-composition measurements.

#### Acceptance criteria

- The map remains reachable from Overview and Coach.
- Body metrics no longer visually implies the map measures physique change.
- Mobile page length and navigation improve.

### I3. Library discovery and custom-exercise management

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P2  
Size: L

#### Current problem

The library presents all visible exercises in one long grid with many movement-pattern chips. Custom exercises cannot be edited, mapped, merged, or deleted.

#### Proposed behavior

Library improvements:

- Sticky search/filter bar.
- Primary filters: muscle, equipment, available-only, favorites, recently used.
- Secondary advanced filter for movement pattern.
- Sort by recent/familiar, alphabetical, or catalog order.
- Favorite exercises.
- Compact list/card density choice.

Custom-exercise manager:

- Rename.
- Assign primary/secondary muscles.
- Set repetition/measurement mode.
- Set equipment and load convention.
- Add aliases.
- Merge into a built-in exercise with history preview.
- Delete only when unused, or remap existing history first.

Persist import aliases:

```text
source provider + normalized source title -> canonical exercise ID
```

#### Acceptance criteria

- A user-selected mapping is automatically proposed on future imports.
- Custom mapping changes recalculate muscle insights transparently.
- Merging exercises does not duplicate or lose sets.
- Library browsing remains fast with a larger catalog.

### I4. Body-metric editing and better deltas

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P2  
Size: M

#### Proposed behavior

- Edit an existing measurement instead of delete/re-add.
- Make same-day duplicate behavior explicit.
- Offer delta versus previous point and versus a configurable rolling average, not only first-ever value.
- Add optional measurement condition tags such as morning/fasted or scale/method.
- Allow chart windows such as 4 weeks, 3 months, 1 year, all.

Avoid adding calorie or medical interpretation.

### I5. Recovery history and workout context

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P2  
Size: M

#### Current problem

Recovery records are stored by date, but only today's record is visible and actionable. Historical records cannot be reviewed alongside workouts.

#### Options

- Show a simple 14/30-day recovery history.
- Display that day's recovery context in workout details.
- Let users optionally snapshot today's check-in into a new workout.
- If historical use is not desired, retain fewer records rather than storing inaccessible data indefinitely.

No correlation should be presented as causation.

## 11. Platform proposals

### P1. IndexedDB and selective rendering

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P2  
Size: XL

#### Current problem

Every write serializes the complete application, and most saves rebuild all views—including hidden ones. Rendering thousands of workout cards conflicts with the advertised 10,000-workout restore limit.

#### Proposed behavior

In stages:

1. Render only affected/visible views.
2. Cache derived weekly/exercise indexes and invalidate them after relevant writes.
3. Paginate or virtualize workout/library history.
4. Move records to IndexedDB behind a repository interface if real datasets approach localStorage limits.

JSON backup remains the portable full export.

#### Approval recommendation

Approve selective rendering and pagination when F1 is implemented. Defer IndexedDB until measured storage/performance thresholds justify migration.

### P2. Installable offline app

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P2  
Size: M

#### Proposed behavior

- Web app manifest.
- Service worker for application-shell caching.
- Installable icon set.
- Explicit offline/update status.
- Safe update strategy that does not clear local data.

This makes “local-first” work without a running local server after installation.

#### Risks

- Service-worker caching can serve stale application code if update UX is poor.
- Must be tested with schema migrations and recovery snapshots.

### P3. Localization and unit preferences

Decision: [ ] Approve [ ] Reject [ ] Defer

Priority: P2  
Size: L

#### Proposed behavior

- English and Polish interface strings.
- Locale-aware dates and decimal input/display.
- Kilogram/pound display preference while storing canonical kilograms.
- Explicit conversion when editing/exporting.

Exercise canonical IDs remain language-independent. Aliases can be language-specific.

#### Acceptance criteria

- Decimal comma input works in Polish locale.
- Changing display units does not alter stored load.
- Import/export units are explicit.
- No translated exercise name creates duplicate history.

### P4. Decide the Garmin strategy

Decision: [ ] Approve integration [ ] Demote UI [ ] Keep as-is [ ] Remove

Priority: P3  
Size: XL for integration; S to demote

#### Current problem

Garmin occupies a full card and dialog but has no functional authorization or sync path.

#### Options

1. **Commit to integration:** backend/service, approved Garmin access, OAuth/PKCE, encrypted token storage, sync jobs, consent/revocation, provider IDs, and monitoring.
2. **Demote:** move the setup explanation to Data/Integrations settings until a backend exists.
3. **Keep as-is:** accept a visible non-functional roadmap placeholder.
4. **Remove:** simplify Body metrics until integration is funded.

Recommendation: demote the prominent card unless a real backend project is approved.

## 12. Proposals to defer intentionally

The following should not be prioritized before the correctness and logging workflow:

- Generative/AI coaching.
- Social feeds, public profiles, or leaderboards.
- Mandatory accounts/cloud synchronization.
- More nutrition prescriptions or calorie targets.
- Automatic injury interpretation.
- Expanding the built-in catalog before custom mapping and measurement modes work well.
- A Garmin backend without approved access and a maintenance plan.

These additions increase scope or risk without fixing the current data and workflow gaps.

## 13. Suggested approval packages

### Package A — Data correctness

Approve:

- C1 Corrected-workout upsert
- C2 Effort provenance
- C3 CSV validation
- C4 Recoverable migrations
- C5 Storage/backup visibility
- F1 Tests and domain extraction

Expected outcome: imports and manual RIR become trustworthy and regression-protected.

### Package B — Better everyday logging

Approve:

- W1 Draft protection
- W2 Repeat/routines
- W3 Set measurement modes
- W7 Faster RIR entry
- W8 Search/history navigation
- A1 Readability

Expected outcome: fewer taps, less data-entry risk, and better support for the current exercise catalog.

### Package C — Model clarity

Approve design work first:

- W4 Load/side conventions
- W6 Source sessions plus daily aggregation
- W9 Routine-aware coaching

Expected outcome: more trustworthy analytics without abandoning daily deduplication.

### Package D — Insight cleanup

Approve:

- I1 Exercise progress charts
- I2 Move muscle status out of Body metrics
- I3 Library/custom-exercise management
- I4 Body-metric editing
- I5 Recovery history

Expected outcome: clearer navigation and more useful history after logging/import foundations are stable.

## 14. Recommended immediate decision

If only one package is approved now, choose **Package A**.

Within Package A, the first implementation order should be:

1. Add regression fixtures and extract current merge/effort logic into testable functions.
2. Define effort provenance and migrate existing RIR/RPE.
3. Implement changed-workout import diff/upsert.
4. Add strict import validation/reporting.
5. Add migration recovery and visible storage health.

This order addresses two reproduced correctness failures before adding product surface area.
