# Liftwise functionality documentation

This document describes the behavior implemented by the current Liftwise application.

Implementation baseline: local data schema version 9.

The repository currently ships two compatible entries during the incremental
transformation:

- `/modern.html` is the primary React/TypeScript experience for Today, focused
  workouts, reviewed imports, routine optimization, Progress, Body & nutrition,
  Library, and Settings & data.
- `/` retains authoring and correction workflows that have not yet been migrated.

Both entries use the same validated local dataset. The exact remaining migration,
hardening, accessibility, PWA, and validation work is specified in
[`REMAINING-WORK-SPEC.md`](REMAINING-WORK-SPEC.md).

## 1. Product and technical scope

Liftwise is a local-first workout tracker focused on muscle-building training. Vite builds it into static files, so the deployed application does not require an account or application server.

The application:

- Logs workouts at individual-set level.
- Supports load/repetition, repetition-only, duration, and distance-plus-duration sets.
- Tracks set type, RIR, imported RPE, notes, load convention, and repetition convention.
- Defaults a new manual set to 3 RIR when neither effort nor a plan-specific RIR target is supplied.
- Imports Hevy-style CSV files with validation, mapping, change preview, correction updates, and undo.
- Imports Fitatu nutrition CSV files with localized parsing, daily aggregation, correction updates, and undo.
- Exports complete JSON backups and one-row-per-set CSV files.
- Calculates effective weekly sets for ten muscle groups.
- Produces explainable volume, progression, recovery, and next-session prompts.
- Tracks recovery check-ins and body measurements.
- Includes a searchable, equipment-aware exercise library and custom-exercise manager.
- Can be installed as a PWA and can reopen from its cache after the first online load.

The app stores canonical weights in kilograms. Display units can be kilograms or pounds.

## 2. Local storage and ownership

The main data is stored in the current browser under:

```text
liftwise-data-v1
```

Related bounded records are stored separately:

```text
liftwise-data-recovery-v7
liftwise-data-corrupt
liftwise-import-undo
liftwise-workout-draft
liftwise-view-state
```

Data belongs to the browser profile and origin where Liftwise is opened. Clearing site data removes it unless a JSON backup exists.

The Data & Backup dialog shows:

- Persistence availability.
- Approximate serialized data size and browser storage estimate.
- Workout and set counts.
- Last JSON backup.
- Last import summary and import history.
- Stored Fitatu nutrition-day count and Fitatu import status.
- Import undo availability.
- Recovery-copy availability.
- Offline-cache state.

Liftwise currently retains its dataset in `localStorage`. IndexedDB is intentionally deferred until real dataset size or measured performance makes that migration useful. Views render selectively, and workout/library lists use bounded pagination.

## 3. Navigation

The five primary views are:

1. **Overview** — weekly dashboard, recovery gate, next-session priority, rhythm, volume, and momentum.
2. **Workouts** — routines, search/filter controls, day-grouped session history, and individual workout details.
3. **Coach insights** — progression guidance, muscle-status analysis, records, and recovery history.
4. **Body metrics** — weight/body-fat summaries, Fitatu calorie/macro summaries, trend charts, and measurement history.
5. **Exercise library** — catalog discovery, equipment filtering, favorites, and custom-exercise management.

Desktop uses a side navigation. Mobile uses a bottom navigation and exposes Data & Backup, JSON backup, CSV export, and import controls inside Workouts.

The last active view and workout filters are retained for the browser session.

## 4. Starter data and profile

New storage starts with labelled demo workouts so the calculations are visible immediately. **Start with an empty log** removes only demo workouts.

The training profile stores:

- Display name.
- Planned sessions per week.
- Training background.
- Smallest usable load increment.
- English or Polish locale preference.
- Kilogram or pound display preference.
- Available equipment.
- Whether machine exercises are shown.

Default equipment:

- Dumbbells.
- Barbell.
- Flat bench.
- Pull-up/dip bar.

Squat rack, adjustable/incline bench, and machines are opt-in. Unavailable exercises remain in historic data but cannot be newly added until their equipment is enabled.

Locale controls date/number formatting and translates the primary navigation, main headings, and primary actions. Detailed coaching and modal copy remains English in this version.

## 5. Exercise catalog, aliases, and autocomplete

The built-in catalog contains 61 exercises plus user-defined custom exercises.

The expanded built-ins include:

- Bird Dog.
- Bulgarian Split Squat.
- Ab Scissors.
- Parallel Bar Leg Raise.
- Clamshell.
- Frog Pump.
- Dumbbell Standing Calf Raise.
- Incline Dumbbell Bench Press.
- Dumbbell and Barbell Bench Press.
- Lying Neck Curl.
- Triceps Dip.
- Pull-up.
- Dumbbell/Barbell Shrug.
- Barbell Curl.
- Paused Barbell Squat.

The editor uses a datalist:

- A user may select a catalog suggestion.
- A user may type an exact catalog name or recognized alias.
- Recognized aliases are canonicalized to the built-in exercise.
- An unknown non-empty name becomes a reusable custom exercise when saved.

Hevy aliases tolerate punctuation, word-order variants, singular/plural forms, and source names such as:

```text
Bench Press (Dumbbell)
Leg Raise Parallel Bars
Lying Neck Curls (Weighted)
Bicep Curl (Barbell)
Standing Calf Raise (Dumbbell)
```

For the supplied `workout_data.csv`, all 44 distinct exercise names map automatically.

Custom exercises can be managed from the library:

- Rename the exercise.
- Add aliases.
- Set primary and secondary muscles.
- Set measurement, load, and repetition conventions.
- Merge its history into a built-in or other custom exercise.
- Delete it when unused.

## 6. Manual workout logging

A manual session stores:

- Local calendar date, not later than today.
- Session name.
- Duration from 1 to 300 minutes.
- Optional notes.
- One to twenty exercise entries.
- One to twenty sets per exercise.

Duplicate exercises in one manual session must be combined into one entry.

### Set types

- Normal working set.
- Warm-up.
- Drop set.

Warm-ups are preserved but excluded from working-set calculations. Drop sets are stored and can be included or isolated in exercise history.

### Measurement modes

| Mode | Required set values |
|---|---|
| Load + reps | Non-negative load and repetitions |
| Reps only | Repetitions |
| Duration | Positive duration in seconds |
| Distance + duration | Positive distance and duration; optional/non-negative load |

All qualified non-warm-up modes count as working sets. Timed and distance work is compared only with matching measurement/load conventions.

### Load and repetition conventions

Each exercise entry stores:

```text
loadMode = total | per_hand | added_bodyweight | assistance | none
repMode = total | per_side
```

These conventions are saved with an effective date for future logs.

- Per-hand dumbbell load is normalized for volume.
- Per-side repetitions are normalized for volume.
- Added bodyweight stores only added external load.
- Assistance uses an inverse progression rule: less assistance is harder.
- Bodyweight/no-load work counts as sets but has zero external-load volume.

### Validation

- Load: 0–2,000 kg canonical.
- Repetitions: 0–100.
- RIR: blank or 0–10 in 0.5 steps.
- Duration: greater than 0 and no more than 86,400 seconds.
- Distance: greater than 0 and no more than 10,000,000 metres.
- Every exercise needs at least one qualified non-warm-up set.

Comma decimals are accepted. Pound inputs are converted to canonical kilograms when pounds are selected.

## 7. Drafts, editing, repeating, and routines

Workout-editor changes autosave after a short delay. Closing a dirty editor warns before discarding it. A saved draft can be resumed or discarded on the next open/reload.

Manual sessions can be fully edited. Imported load, repetitions, timestamps, and set metadata remain source-controlled; imported sessions expose the dedicated RIR editor instead.

**Repeat workout** creates a new manual draft from an existing session:

- Exercise structure and load/rep/time values are copied.
- Imported RPE, RIR, manual RIR, and effort provenance are cleared.
- The repeated workout starts as a new editable session.

**Save as routine** stores reusable exercise and set-count structure. Routines can:

- Be started from Workouts.
- Be assigned to or removed from the current weekday.
- Be deleted.
- Become the base of the dashboard’s next-session card when scheduled today.

Coverage suggestions are treated as optional adjustments to a scheduled routine, not a replacement program.

## 8. Workout history

Workouts can be filtered by:

- All, current week, or last 30 days.
- Free-text session or exercise search.
- Manual or imported source.
- Missing RIR.
- From/to date.

Filters and the active view survive navigation during the browser session. Long histories use **Load more days**.

The list groups workouts by local calendar day without destructively merging sessions:

- The day header shows session count, unique exercise count, duration, and working sets.
- Repeated exercise names are shown once in the day summary.
- Each source/manual session remains individually openable and deletable.
- Two sessions on one day still count as two sessions in session statistics and history.

Week navigation stops at the earliest week containing data and cannot move into the future.

## 9. Workout details and RIR editing

Workout detail shows:

- Date, duration, working-set count, and normalized external-load volume.
- Exercise-level working sets, progression comparison, notes, and top set.
- Recovery context captured for the workout date.
- Per-set values and effort provenance.

RIR can be added or edited from every workout, including imported workouts.

The RIR editor:

- Saves only changed fields.
- Leaves untouched blank, imported, or RPE-derived values unchanged.
- Can show only sets missing RIR.
- Can copy the focused value downward.
- Supports Arrow Up/Down navigation.
- Allows an intentional blank override.

Effort precedence:

```text
manual-cleared
manual RIR
explicit imported RIR
RIR derived from raw imported RPE
missing
```

Examples shown by the UI:

- Estimated from imported RPE 8.
- Manual override.
- Imported RIR.
- Intentionally cleared.
- RIR missing.

Raw imported RPE is retained for audit/export even when a manual RIR becomes authoritative.

## 10. Hevy CSV import

The importer expects workout title, start date/time, and exercise title columns. It accepts the common Hevy fields for:

- Start/end times and notes.
- Exercise and exercise notes.
- Superset ID.
- Set index/type.
- Kilogram, pound, or generic weight.
- Repetitions.
- Distance and duration.
- RPE and explicit RIR.
- Liftwise measurement/load/rep convention columns on round-trip files.

Pounds are converted to kilograms.

### File and row safeguards

- CSV file limit: 10 MB.
- Row limit: 100,000.
- Duplicate headers and unclosed quotes are rejected.
- Rows with mismatched column counts are rejected.
- Future/invalid dates are rejected.
- End time before start time is rejected.
- Workout duration over 1,440 minutes is rejected.
- Numeric values outside their supported ranges are rejected.
- Invalid measurement/load/rep conventions are rejected.
- Oversized per-workout exercise/set structures are rejected.

Rejected rows show source row number and reasons. A downloadable report is available. When any rows are rejected, **Import valid rows only** must be explicitly checked before the valid rows can be committed.

### Scope

The preview can use:

- The entire valid file.
- The latest seven-day window ending on the newest workout date in the file.

For the supplied file:

- Entire file: 47 workouts, 1,129 sets, 44 exercises.
- Latest seven days: 4 workouts, 85 sets, 16 exercises.

Rows outside the selected date scope are ignored for that import.

### Exercise mapping

Every source exercise is previewed with a target:

- Built-in match.
- Existing custom exercise.
- User-selected match.
- Keep as a new custom exercise.

Confirmed built-in mappings are remembered in `importAliases` and reused for later Hevy files.

### Merge and correction behavior

Source identity is separate from content identity:

```text
sourceIdentity = provider ID, or normalized start timestamp + workout title
contentFingerprint = normalized source-controlled workout content
```

The preview reports:

- Added.
- Updated.
- Unchanged.
- Conflicted.

Rules:

- New identity: add one source session.
- Same identity and same content: skip unchanged.
- Same identity and corrected content: update the existing session.
- Corrected source values replace source-controlled values.
- Matching manual RIR overlays survive corrected imports.
- If a corrected source removes a set that has a manual RIR overlay, the workout is marked conflicted and is not silently changed.
- Legacy collapsed same-day imports with multiple source identities are reported as conflicts rather than guessed.

Source sessions stay separate. Day summaries aggregate exercise names without changing session identity or count.

### Replace, history, and undo

Replace mode clears workout history only. Profile, targets, routines, body metrics, custom exercises, and preferences remain.

Each successful import records:

- File name and timestamp.
- Scope and behavior.
- Added, updated, unchanged, conflicted, and rejected counts.
- Affected dates.

Before commit, Liftwise keeps one bounded full-data undo snapshot. **Undo last import** restores it.

## 11. Fitatu CSV nutrition import

The shared **Import file** action first asks whether the user is importing **Workout history** or **Meals and nutrition**. Workout files go only to the Hevy parser and meal files go only to the Fitatu parser, so a malformed file is not silently interpreted as the other data type. The same chooser retains a separate JSON-backup restore action. **Body metrics** also exposes a dedicated **Import Fitatu CSV** action.

The importer recognizes:

- Polish and English date, calorie, protein, carbohydrate, fat, and fiber headings.
- Comma-, semicolon-, and tab-separated files, including an Excel-style `sep=` directive.
- Decimal commas, decimal points with arbitrary precision, space-grouped thousands, and values containing units.
- The real meal-plan headings `Products and dishes`, `calories (kcal)`, `Protein (g)`, `Fats (g)`, `Carbohydrates (g)`, and `Fibre (g)`.
- Metadata rows before the table header.
- Dates written as `YYYY-MM-DD`, `DD.MM.YYYY`, `DD/MM/YYYY`, and equivalent dash/slash variants.
- Repeated dates, blank carried-down dates, product rows, meal-total rows, and daily-total rows.

At least date, calories, and two macronutrient columns are required. Each accepted calendar day becomes one normalized record containing:

```text
date
caloriesKcal
proteinG
carbsG
fatG
fiberG
sourceIdentity
contentFingerprint
sourceRowCount
aggregation
importBatchId
importedAt
```

When an explicit daily total exists, it takes precedence over item rows. A single generic total is used directly; multiple generic totals are treated as meal totals and summed. Otherwise product rows are summed. This prevents total and product rows from being counted twice.

The preview reports:

- Nutrition days and accepted source rows.
- Date range and rejected rows.
- Added, updated, and unchanged days.
- Separator and total-row detection warnings.

Invalid numbers, unsupported ranges, malformed dates, column overflow, and future planned days are rejected. A rejected-row CSV report is available, and partial import requires explicit confirmation.

Source identity is the Fitatu calendar date. Re-importing the same date skips identical content and updates corrected calories/macros. Merge mode preserves unrelated days; replace mode clears only previously imported Fitatu nutrition. Workouts, body metrics, routines, profile data, and preferences are unaffected.

Each Fitatu import uses the same bounded full-data undo snapshot and import history as workout imports. Fitatu nutrition is included in JSON backup validation and can be cleared independently from **Data & Backup**.

The **Body metrics** view shows the latest 14 imported days, recent seven-entry calorie and macro averages, and the latest imported protein value. When body weight exists, the protein card compares the imported value with the displayed `1.6 g/kg/day` starting point without treating it as a medical prescription or a hard pass/fail target.

## 12. CSV export

CSV export writes one row per stored set and includes:

```text
title,start_time,end_time,description,exercise_title,superset_id,
exercise_notes,set_index,set_type,weight_kg,reps,distance_km,
duration_seconds,rpe,rir,measurement_mode,load_mode,rep_mode,effort_source
```

Export policy:

- `rpe` is the original raw RPE when present.
- `rir` exports a manual override or explicit imported RIR.
- RPE-derived effective RIR is not misrepresented as an explicit source RIR.
- An intentionally cleared manual RIR exports blank.
- Convention and provenance columns make Liftwise round trips explicit.

CSV does not contain profile, routines, body measurements, recovery, or other complete-app settings.

## 13. JSON backup, migration, and recovery

JSON is the complete backup format. Restore validates structure and supported limits before replacing the current dataset.

Before a schema migration:

1. The previous payload is retained under the bounded recovery key.
2. Migration runs on normalized data.
3. The migrated result is validated.
4. It renders once.
5. Only then is schema version 9 committed to the primary key.

Malformed primary data is retained as a corrupt recovery copy. The recovery banner can:

- Download the raw recovery payload.
- Restore the previous-version snapshot.
- Start fresh after confirmation.

Writes restore their previous in-memory value when browser persistence fails. Import and restore operations use whole-data snapshots to prevent partial commits.

## 14. Overview and coaching

The dashboard uses Monday-through-Sunday weeks.

It shows:

- Sessions against the weekly plan.
- Qualified working sets.
- Effort-data coverage.
- Muscle targets reached.
- Daily set chart.
- Training rhythm.
- Muscle coverage.
- Recent exercise momentum.
- Recovery gate.
- Routine-aware next-session priority.

Primary-muscle work receives 1.0 effective set per qualified set. Secondary-muscle work receives 0.5.

These credits are transparent planning heuristics, not physiological measurements.

## 15. Progression and exercise history

Exercise history includes:

- A progress chart.
- Accessible text data table.
- Session-by-session comparisons.
- Best load by repetition count.
- Personal-record markers.
- Normal, drop-set, or all non-warm-up filtering.

Comparisons require compatible measurement, load, and repetition conventions.

Load/repetition movements use conservative double progression:

- Missing effort: hold and log RIR.
- All normal sets at the rep ceiling with at least 1 RIR twice: add one configured load increment.
- One ceiling completion: confirm once.
- Two comparable hard misses below the rep floor: reduce external load or regress a bodyweight variation.
- New heavier load without lost reps: hold and consolidate.

Assistance reverses normal load logic:

- Lower assistance is harder.
- Assistance is reduced only after repeated complete results.
- The app never recommends increasing assistance as though it were an external-load progression.

Duration and distance movements use mode-matched controlled-improvement prompts rather than rep/load formulas.

## 16. Recovery

A daily recovery check-in stores:

- Sleep hours.
- Energy, soreness, and stress from 1–5.
- Pain/injury concern.
- Optional note.

It is a transparent conservative heuristic:

- Normal context leaves planning unchanged.
- Caution/low recovery pauses automatic set additions, raises target RIR, and reduces generated work.
- Pain concern pauses the generated workout.

The Insights view shows 30-day recovery history. A workout saved for today retains a recovery snapshot so later detail views explain the context that existed at logging time.

The feature does not diagnose pain or calculate a validated readiness score.

## 17. Muscle status

Muscle-status analysis lives under Coach Insights rather than Body metrics.

It evaluates rolling seven-day effective sets, the preceding comparison period, and direct-exercise performance.

- **Green:** coverage is in range and recent direct performance improved.
- **Yellow:** coverage, comparison evidence, or volume needs attention.
- **Red:** sufficient volume exists but strict multi-session hard-stall conditions are met.

Selecting a body region by pointer, Enter, or Space shows its evidence, related exercises, performance comparisons, and library shortcut.

The map describes logged training, not visible muscle growth.

## 18. Body metrics

Manual body records can include:

- Weight from 20–500 kg canonical.
- Body-fat estimate from 1–100%.
- Measurement condition tag.
- Note.

Records can be added, edited, or deleted. Saving a second record for the same date asks for explicit replacement confirmation.

The view provides:

- Latest weight and body-fat estimate.
- Latest imported Fitatu protein and seven-entry calorie/macro averages.
- Fourteen most recent normalized Fitatu nutrition days.
- Difference from the prior comparable check-in.
- Difference from the recent average.
- 30/90/180-day or all-time chart windows.
- Accessible chart data tables.
- Complete newest-first history.

When weight exists, the dashboard displays `1.6 g/kg/day` as a practical protein starting point and `1.4–2.0 g/kg/day` as general context.

## 19. Exercise library

Primary filters:

- Search.
- Muscle.
- Equipment.
- Available-only.
- Favorites-only.
- Recent, alphabetical, or catalog sorting.
- Comfortable or compact density.

Movement-pattern chips provide a second filter. Machine movements are hidden by default unless explicitly shown; they remain unavailable for logging/recommendations until machine equipment is enabled.

Favorites, density, availability, and sorting preferences persist.

## 20. Accessibility and responsive behavior

Implemented behavior includes:

- Semantic form labels and accessible button names.
- `aria-current` navigation.
- Live toast and persistent import/recovery status.
- Focus restoration when dialogs close.
- Focus movement after view navigation.
- Keyboard-accessible muscle map and RIR editor.
- Text alternatives for charts.
- Visible focus styles.
- Reduced motion support.
- Core touch targets of approximately 40 px or more.
- Increased metadata text size/contrast.
- Layout support down to 320 CSS pixels without horizontal page overflow.
- Reflowed set editor, filters, day cards, charts, and dialogs.

## 21. PWA behavior

The Vite PWA build generates `manifest.webmanifest` and a Workbox service worker from `vite.config.js`. The generated service worker precaches the versioned application shell and removes outdated caches.

- First load requires a network connection.
- Later loads can use the cached shell offline.
- Versioned build assets are served from the precache when offline.
- When an update is available, the application shows an explicit **Update now** action rather than mixing old HTML and JavaScript assets.
- Installation requires HTTP on localhost or HTTPS in production.

## 22. Data model

The persisted root includes:

```text
schemaVersion
profile
targets
customExercises[]
routines[]
importAliases
exercisePreferences
favoriteExercises[]
libraryPreferences
importBatches[]
bodyMetrics[]
nutritionDays[]
recoveryCheckins[]
integrations
appMeta
workouts[]
```

A normalized Fitatu nutrition day includes:

```text
id
date
caloriesKcal
proteinG
carbsG
fatG
fiberG
source / sourceIdentity
contentFingerprint
sourceRowCount
aggregation
importBatchId
importedAt
```

A workout includes:

```text
id
source
sourceIdentity
sourceKeys[]
contentFingerprint
date
name
duration
notes
startTime / endTime
entries[]
recoverySnapshot
importBatchId / importBatchIds[]
updatedAt
```

An entry includes:

```text
exerciseId
sourceExerciseName
exerciseNotes
supersetId
measurementMode
loadMode
repMode
sets[]
```

A normalized set includes:

```text
index
sourceSetId
type
measurementMode
weightKg
reps
durationSeconds
distanceMeters
rawRpe
explicitImportedRir
manualRir
manualRirCleared
rir
effortSource
```

## 23. Automated and browser verification

The checked-in Node test suite covers:

- RPE-derived effort provenance.
- Dirty-only manual RIR updates.
- Intentional RIR clearing.
- Corrected source updates with manual-RIR preservation.
- Conflict detection when a manually edited source set disappears.
- Unchanged import detection.
- Same-day aggregation with preserved sessions.
- Measurement-mode qualification.
- Load/repetition convention volume.
- Polish and English Fitatu CSV parsing.
- Semicolon and decimal-comma handling.
- Fitatu item aggregation and daily-total precedence.
- Fitatu metadata-row detection and future-row rejection.

Run:

```bash
npm test
npm run test:coverage
npm run check
```

Browser smoke/regression coverage has verified:

- All primary views and dialogs load without console errors.
- Corrected import upsert and unchanged skip.
- Manual RIR preservation through correction import.
- Recent-seven-day scoping.
- Rejected-row confirmation.
- The supplied 1,129-row CSV and all 44 mappings.
- Manual duration workout entry.
- 320 px layout without horizontal overflow.

## 24. Intentional limitations

- No cloud account or automatic cross-device synchronization.
- No full localization of all detailed English coaching/modal copy.
- No IndexedDB storage yet.
- No direct editing of imported source-controlled load/repetition data.
- No automatic Garmin authorization or synchronization.
- Garmin remains a demoted roadmap item in Data & Backup until approved API access and a secure backend exist.
- Fitatu integration accepts CSV; proprietary/binary XLS and PDF exports are not parsed.
- Fitatu food-item details are aggregated to daily nutrition totals rather than retained as a meal diary.
- CSV is not a complete backup; use JSON for complete restore.
- Superset IDs are preserved but do not change calculations.
- Coaching rules cannot assess technique, diagnose pain, or replace qualified medical/coaching advice.
- The current goal model is muscle-building oriented; training background is context, not a hidden sport-specific program.
