# Liftwise

Liftwise is a local-first workout tracker that turns logged working sets into simple, explainable training prompts. It is an installable Vite web app: browser data stays local, and the production build remains deployable as static files without an account or application server.

See [`FUNCTIONALITY.md`](FUNCTIONALITY.md) for the complete implemented feature, calculation, import/export, validation, and data-model reference.

## Run it locally

```bash
npm install
npm run dev
```

Then open the URL printed by Vite (normally `http://localhost:5173`). Build deployable files with `npm run build`; `npm run preview` serves that production build locally. Any static HTTPS hosting service can publish the generated `dist/` directory. The generated service worker makes the application shell available offline after its first successful load.

Run the regression suite with:

```bash
npm test
npm run test:coverage
npm run check
```

## What it does

- Logs load/repetition, repetition-only, duration, and distance-plus-duration sets. Exercise autocomplete accepts a catalog suggestion, alias, or new reusable custom name.
- Autosaves workout drafts, repeats prior sessions without copying effort, and supports reusable weekday routines.
- Imports Hevy workout CSV exports with validation, rejected-row reports, remembered mapping, correction updates, conflict detection, history, and undo.
- Imports Fitatu nutrition CSV exports into daily calorie, protein, carbohydrate, fat, and optional fiber summaries.
- Exports one CSV row per set and keeps JSON import/export as the complete Liftwise backup format.
- Logs and edits body weight and optional body-fat estimates, with measurement conditions, useful deltas, selectable chart windows, and text tables.
- Shows session rhythm, daily and weekly working sets, effort context, exercise momentum, and muscle coverage.
- Counts primary-muscle work fully and secondary-muscle work at half credit.
- Flags muscles below or above editable weekly set ranges.
- Gives deterministic rep/load prompts from comparable recent logs, including the rule and inputs behind each `WHY`.
- Uses an optional daily sleep, energy, soreness, stress, and pain check-in to conservatively reduce or pause automated suggestions.
- Shows a practical protein starting point and range after body weight is logged, plus a general 7-hour sleep baseline.
- Offers a searchable/favoritable movement library organized by muscle, equipment, movement pattern, and availability, plus management and muscle mapping for custom exercises.
- Preserves separate same-day sessions while showing one deduplicated exercise summary per day.
- Supports English/Polish primary-interface preferences and kg/lb display while storing canonical kilograms.
- Includes a Data & Backup center, transactional migration recovery, and visible persistence/storage health.
- Defaults to a home-gym profile: adjustable dumbbells, barbell, bench, and pull-up/dip bar. Machine movements are hidden by default, tagged when shown, and never used in a recommendation unless machines are enabled.
- Keeps fonts, storage, calculations, and interactions local; opening the research or Garmin links is the only time the app leaves the page.

Starter data is deliberately included so the dashboard demonstrates the calculations immediately. It is labeled separately from real history and can be removed in one action without deleting workouts you logged or imported.

## Import from Hevy

1. In Hevy, open **Profile → Settings → Export & Import Data → Export Data → Export Workouts** ([official Hevy instructions](https://help.hevyapp.com/hc/en-us/articles/38001424401943-How-to-Import-Strong-App-CSV-Files-and-Export-Your-Data-in-Hevy)).
2. Save the workout CSV to your device.
3. In Liftwise, choose **Import file → Workout history** and select that CSV.
4. Choose whether to import the entire file or only the latest seven-day window ending on the newest workout in that CSV.
5. Review the scoped summary and exercise mappings. Known movements are matched automatically; uncertain movements can be mapped manually or preserved as custom exercises.
6. Choose **Merge safely** or **Replace demo workouts**, then import.

Liftwise preserves Hevy's individual set types, notes, loads, reps, durations, distances, and RPE values. Pound exports are converted to kilograms. Warm-up sets remain in the history but do not count toward working-set volume or muscle coverage. When Hevy includes RPE but no RIR, Liftwise stores the original RPE and derives an estimated `RIR = 10 − RPE`.

**Merge safely** preserves every source session. Workouts are grouped under their calendar day, but exercise names are deduplicated only in that derived day summary. Source identity plus a content fingerprint distinguishes a new session, unchanged repeat, and corrected source workout. Corrected source values update the existing session while matching manual RIR overrides stay in place. If a manually edited source set disappears, Liftwise reports a conflict instead of silently losing the RIR.

The preview reports added, updated, unchanged, and conflicted sessions. Invalid rows show reasons and require explicit partial-import approval. The Data & Backup center records bounded import history and can undo the latest import.

The CSV export uses a Hevy-style, one-row-per-set structure with explicit RIR, measurement/load/rep convention, and effort-source columns.

## Import nutrition from Fitatu

1. In Fitatu Premium or Premium+AI, open the data export and choose **CSV** ([official Fitatu export overview](https://www.fitatu.com/en/help/how-does-the-%22data-export%22-feature-work)).
2. Select **Import Fitatu CSV** in **Body metrics**, or choose **Import file → Meals and nutrition**.
3. Review the normalized daily totals, rejected rows, and the added/updated/unchanged preview.
4. Merge corrected days safely or replace only the previously imported Fitatu nutrition.

Liftwise recognizes Polish and English headings, comma/semicolon/tab separators, decimal commas, product rows, meal totals, and daily totals. It stores one record per calendar day with calories, protein, carbohydrates, fat, and optional fiber. When total rows are present, they take precedence so product rows are not counted twice. Future planned days and invalid values are rejected; importing valid rows requires explicit confirmation when a file is only partially accepted.

Re-importing the same date skips unchanged data and updates corrected values. The last import can be undone from **Data & Backup**, and all Fitatu nutrition is included in the complete JSON backup. Imported nutrition remains local to the browser and is shown in **Body metrics** alongside the body-weight-based protein context.

## Body metrics

Open **Body metrics** to log a weight, a body-fat estimate, or both. The current cards identify the measurement date and the change since the first check-in; charts show up to the latest 12 daily check-ins, spaced by their actual dates. If a future Garmin sync provides a value on the same day, a manual value takes priority; multiple manual check-ins are kept in the history rather than discarded.

After weight is logged, the dashboard shows `1.6 g/kg/day` as a practical protein starting point and `1.4–2.0 g/kg/day` as context—not a personalized nutrition prescription. It does not estimate calories or claim protein can replace adequate training, food quality, or medical nutrition advice.

### Muscle progress map

The front/back map is under **Coach insights** and is a training-status view, not a claim about visible muscle growth. It uses a rolling seven-day window: green requires an in-range effective-set total plus a positive direct exercise comparison in the last 21 days; yellow means the set target, comparison data, or volume needs attention; red requires enough work in both the current and prior seven-day windows, no positive direct comparison in 21 days, and three hard unchanged direct appearances spanning at least 21 days. Selecting a region shows its exact evidence and recent mapped exercises.

Body metrics are included in **Backup JSON** and its restore flow. They are deliberately not added to the Hevy-style workout CSV because that format is one row per exercise set, not a body-composition interchange format.

## Garmin Connect

Garmin is deliberately demoted to the Data & Backup dialog. The data model can retain Garmin-sourced measurements, but the static app does not pretend that a browser-only page can link an account. Garmin Connect API access requires approval through Garmin’s developer program, and Garmin’s OAuth flow needs secure server-side token exchange and storage. See Garmin’s [developer-program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/), [Health API overview](https://developer.garmin.com/gc-developer-program/health-api/), and [OAuth 2.0 + PKCE specification](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE.pdf).

Once approved, the next implementation step is a small backend or serverless service that: receives the OAuth callback, exchanges and encrypts refresh tokens server-side, syncs consented Garmin data, and sends normalized body measurements to Liftwise. Garmin-imported records are designed to carry a source ID so repeated syncs can be deduplicated. Until that service and Garmin credentials exist, manual check-ins are the safe working path.

## Coaching model and limits

The app treats volume ranges as starting points, not universal prescriptions. It does **not** diagnose injuries, estimate medical readiness, replace a coach, or claim an exercise is objectively best. Pain, health conditions, technique, recovery, access to equipment, and personal preference should override an automated prompt.

The main rules are transparent in the in-app “Method & sources” panel:

1. Use weekly working sets by muscle group as the main hypertrophy coverage signal.
2. Use RIR and a rep range to decide whether to add your configured load increment, hold steady, or reduce/manage fatigue.
3. Let a daily recovery check-in veto automatic “add more” advice; a pain concern pauses the generated session.
4. Filter new logging and recommendations to the equipment selected in the Training Profile.
5. Suggest exercises based on movement coverage, familiarity, and practical substitutions—rather than declaring one movement universally superior.
6. Keep basic recovery context visible: a general 7-hour adult sleep baseline and a protein starting point when body weight is known.
7. Compare only compatible measurement/load/repetition conventions; treat lower assistance as harder and timed/distance work separately.

The product is deliberately scoped to muscle-building guidance. “Training background” is stored as profile context, but it does not silently apply different targets or pretend that the same rules are a strength-sport program.

## How the next session is chosen

Liftwise always uses the current calendar week and your editable muscle-set ranges—even while you browse an older report. Each qualified non-warm-up working set gives its exercise’s primary muscle(s) **1.0 effective set** and secondary muscle(s) **0.5 effective set**. For every muscle it calculates:

```text
gap = selected weekly minimum − effective sets already logged
```

When a routine is scheduled today, it becomes the next-session base and coverage gaps are optional adjustments. Without a scheduled routine, the largest positive gaps become candidates. Liftwise softly deprioritizes a muscle that had direct work in the last 48 hours, chooses familiar compatible movements, and caps a movement at three suggested sets. If no muscle is below its selected minimum, it suggests maintenance work for the least-covered muscles instead. Suggestions are filtered to enabled equipment.

For each muscle, Coach Insights applies one deterministic planning rule: add at most **3 direct working sets** toward a gap, maintain inside the range, or review work above the range without calling it inherently harmful. Every card shows its inputs and a `WHY` statement. Load decisions use conservative double progression: every normal working set must reach the range ceiling with at least 1 RIR in two appearances no more than 28 days apart before the configured load jump is added. Two recent below-floor, 0-RIR appearances reduce external load by at least one usable increment or regress a bodyweight variation. Missing RIR/RPE results in a hold-and-log-effort prompt instead of an effort-based load change.

A caution or low-recovery check-in pauses set-addition advice, raises the suggested RIR target, and caps generated movements at two sets. A new or unusual pain concern disables the generated workout. These are transparent, user-controlled safety heuristics—not a validated readiness score or diagnosis.

The 1.0/0.5 direct/secondary-set accounting and the 3-set volume cap are transparent conservative heuristics—not a claim that every compound lift contributes identically to every muscle. Pain, recovery, technique quality, and individual coaching direction override the app.

## Home-gym defaults

The default profile enables adjustable dumbbells, a barbell, flat bench, and pull-up/dip bar. Squat-rack and incline-bench movements stay hidden until you enable them, because a bench-press setup alone should not be assumed safe for back squats. The **Machine: off** chip can reveal machine movements for reference; they remain unavailable for new logging and recommendations until machine access is enabled in the profile.

Open **Why this session?** in the dashboard to see every current-week planning input. In **Workouts**, open any workout and choose **Add / edit RIR** to record per-set RIR without changing load, reps, set type, raw RPE, or import metadata. Only changed fields become manual overrides, and those RIR values survive corrected CSV imports. Manual workouts expose the full session editor; imported source-controlled values remain read-only.

## Research used

- [ACSM 2026 resistance training position stand](https://pubmed.ncbi.nlm.nih.gov/41843416/) — resistance training prescription for healthy adults, including the role of higher weekly volume for hypertrophy.
- [WHO physical activity guideline recommendations](https://www.ncbi.nlm.nih.gov/books/NBK566046/) — muscle-strengthening work involving major muscle groups on two or more days per week.
- [Systematic review on exercise variation](https://pubmed.ncbi.nlm.nih.gov/35438660/) — supports purposeful, not excessive/random, exercise variation.
- [Meta-regression on proximity to failure](https://pubmed.ncbi.nlm.nih.gov/38970765/) — RIR/proximity to failure is useful context, but the app avoids a simplistic “always train to failure” rule.
- [2026 volume/frequency meta-regression](https://pubmed.ncbi.nlm.nih.gov/41343037/) — supports treating direct and indirect work as separate inputs and using volume as an individual starting point rather than a universal prescription.
- [Meta-analysis on inter-set rest intervals](https://pubmed.ncbi.nlm.nih.gov/39205815/) — supports resting long enough to preserve useful work rather than enforcing a universal short timer.
- [Protein-supplementation meta-analysis](https://pubmed.ncbi.nlm.nih.gov/28698222/) — informs the displayed `1.6 g/kg/day` practical starting point while acknowledging large individual variation.
- [AASM/SRS adult sleep-duration consensus](https://aasm.org/resources/pdf/adultsleepdurationconsensus.pdf) — supports the visible general baseline of at least seven hours for healthy adults.

## File map

- `index.html` — application structure, modals, and accessible labels.
- `src/main.js` — Vite application entry point.
- `src/styles.css` — responsive visual system; works on desktop and small screens.
- `src/domain.js` — tested ES-module rules for effort, import identity, aggregation, measurement, and volume.
- `src/ui/import-chooser.js` — isolated workout, Fitatu, and backup file routing.
- `src/app.js` — catalog, persistence, calculations, charts, and remaining browser controllers.
- `src/pwa.js`, `vite.config.js`, `public/icons/` — generated installable/offline shell and update flow.
- `test/` — Vitest domain, component, and jsdom application-integration tests.
