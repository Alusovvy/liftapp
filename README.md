# Liftwise

Liftwise is a workout tracker that turns logged working sets into simple, explainable training prompts. The interface is an installable Vite + React app; data is saved to a small Node.js/Express/SQLite server, one account per person, so a few friends can each keep their own history and compare current-week stats.

## Launch the app

Liftwise now has two parts that both need to run: the API server (Node/Express/SQLite) and the Vite frontend.

```bash
npm install

# 1. Start the API server (keep this running in one terminal)
npm run server

# 2. In another terminal, create an account (admin-only — no public signup)
npx tsx server/scripts/create-user.ts <username> <password>

# 3. Start the frontend
npm start
```

`npm start` opens `http://localhost:5173/modern.html`. Sign in with the
account you just created. Vite proxies `/api` requests to the server at
`http://127.0.0.1:3001` by default (`LIFTWISE_API_ORIGIN` overrides this).

Use `npm run dev:server` instead of `npm run server` during development —
it restarts the API on file changes. The SQLite database file is created at
`server/data/liftwise.sqlite3` (override with `LIFTWISE_DB_PATH`); it is
gitignored and holds every account's data, so back it up like you would any
database.

Accounts are invite-only: run `create-user.ts` again with an existing
username to reset that person's password. There is no self-service signup
route.

To check and preview the production build:

```bash
npm run check
npm run test:e2e
npm run preview:modern
```

`npm run check` runs syntax checks, typecheck, lint, format check, the unit
suite, and a production build. `npm run test:e2e` starts its own throwaway
API server and SQLite database automatically (see `playwright.config.ts`)
and drives the real signed-in app with Playwright.

Additional regression commands:

```bash
npm test
npm run test:coverage
```

### Legacy interface

`index.html` (`src/app.js`) is the original vanilla-JS interface. It has
**not** been updated to talk to the server — it still reads and writes only
`localStorage` in the browser, so it no longer shares data with the
account-based modern app at `/modern.html`. Treat it as a frozen reference
for flows not yet ported (routine authoring, historical editing,
recovery/body-metric correction) rather than a working alternative view of
your account's data.

### Hosting on your own server

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for a step-by-step guide to running
Liftwise on a VPS behind Nginx with a real domain and TLS, including a
systemd service and Nginx config in [`deploy/`](deploy/), or
[`DOCKER-DEPLOYMENT.md`](DOCKER-DEPLOYMENT.md) for the same end state with
the app running in Docker instead of directly on the host. The commands
above run everything on `localhost` only; `SESSION_SECRET` must be set
explicitly before running the server with `NODE_ENV=production` (it
refuses to start on a default secret in production).

## What it does

- Logs load/repetition, repetition-only, duration, and distance-plus-duration sets. Exercise autocomplete accepts a catalog suggestion, alias, or new reusable custom name.
- Defaults new manual exercise sets to 3 RIR when no effort or plan-specific target is supplied; explicit and imported effort remains unchanged.
- Autosaves workout drafts locally, repeats prior sessions without copying effort, and supports reusable weekday routines.
- Imports Hevy workout CSV exports with validation, rejected-row reports, remembered mapping, correction updates, conflict detection, history, and undo.
- Imports Fitatu nutrition CSV exports into daily calorie, protein, carbohydrate, fat, and optional fiber summaries.
- Exports one CSV row per set and keeps JSON import/export as the complete Liftwise backup format.
- Logs and edits body weight and optional body-fat estimates, with measurement conditions, useful deltas, selectable chart windows, and text tables.
- Shows session rhythm, daily and weekly working sets, effort context, exercise momentum, and muscle coverage — with previous-week navigation, not just the current week.
- Counts primary-muscle work fully and secondary-muscle work at half credit.
- Shows an accessible front/back body map alongside the ranked muscle-coverage list, colored by whether each muscle is below, within, or above its configured weekly range; selecting a region highlights the matching row.
- Flags muscles below or above editable weekly set ranges.
- Gives deterministic rep/load prompts from comparable recent logs, including the rule and inputs behind each `WHY`.
- Uses an optional daily sleep, energy, soreness, stress, and pain check-in to conservatively reduce or pause automated suggestions.
- Shows a practical protein starting point and range after body weight is logged, plus a general 7-hour sleep baseline.
- Offers a searchable/favoritable movement library organized by muscle, equipment, movement pattern, and availability, plus management and muscle mapping for custom exercises.
- Preserves separate same-day sessions while showing one deduplicated exercise summary per day.
- Lets everyone with an account compare current-week sessions and per-muscle weekly sets against each other (see **Compare with friends** below).
- Supports English/Polish primary-interface preferences and kg/lb display while storing canonical kilograms.
- Includes a Settings & data area with JSON backup export/restore and account sign-out.
- Defaults to a home-gym profile: adjustable dumbbells, barbell, bench, and pull-up/dip bar. Machine movements are hidden by default, tagged when shown, and never used in a recommendation unless machines are enabled.

Starter data is deliberately included so the dashboard demonstrates the calculations immediately. It is labeled separately from real history and can be removed in one action without deleting workouts you logged or imported.

## Accounts and data

- An admin creates each account with `server/scripts/create-user.ts`; there is no public signup form.
- Passwords are hashed with argon2. Signing in starts a server-side session (httpOnly cookie); there is no client-side password storage.
- Once signed in, all reads and writes go through the API — the app requires a network connection to the server (it is not offline-first for data, though the installable app shell can still be cached for faster loads).
- A brand-new account has no data. **Settings & data** or the first-run screen offers a small default starting profile (default equipment, targets, and preferences) you can adjust from there; it does not fabricate workout history.
- Every account can currently see every other account's **Compare** stats — this is meant for a small trusted group, not a public or semi-public deployment. There is no per-friend sharing control yet.
- **Settings & data** still exports/imports the complete JSON backup format; export/restore now read from and write to your account on the server instead of only to the browser.
- Every request is logged to a `request_logs` table (method, path, status, timing, the signed-in user if any, and IP — never request/response bodies, so passwords and workout data never appear there). There's no in-app viewer; see `DEPLOYMENT.md` for querying it directly with the `sqlite3` CLI.

## Compare with friends

Open **Compare** to see everyone's current Monday–Sunday week side by side:
sessions logged, or weekly effective sets for any single muscle (same 1.0
direct / 0.5 secondary credit used in your own Progress → Muscles view).
Pick a metric from the dropdown; people are ranked highest to lowest for
that metric. This is descriptive, not a leaderboard claim about who is
training "correctly," and it only ever shows the current week.

## Import from Hevy

1. In Hevy, open **Profile → Settings → Export & Import Data → Export Data → Export Workouts** ([official Hevy instructions](https://help.hevyapp.com/hc/en-us/articles/38001424401943-How-to-Import-Strong-App-CSV-Files-and-Export-Your-Data-in-Hevy)).
2. Save the workout CSV to your device.
3. In Liftwise, choose **Import file → Workout history** and select that CSV.
4. Choose whether to import the entire file or only the latest seven-day window ending on the newest workout in that CSV.
5. Review the scoped summary and exercise mappings. Known movements are matched automatically; uncertain movements can be mapped manually or preserved as custom exercises.
6. Choose **Merge safely** or **Replace demo workouts**, then import.

Liftwise preserves Hevy's individual set types, notes, loads, reps, durations, distances, and RPE values. Pound exports are converted to kilograms. Warm-up sets remain in the history but do not count toward working-set volume or muscle coverage. When Hevy includes RPE but no RIR, Liftwise stores the original RPE and derives an estimated `RIR = 10 − RPE`.

**Merge safely** preserves every source session. Workouts are grouped under their calendar day, but exercise names are deduplicated only in that derived day summary. Source identity plus a content fingerprint distinguishes a new session, unchanged repeat, and corrected source workout. Corrected source values update the existing session while matching manual RIR overrides stay in place. If a manually edited source set disappears, Liftwise reports a conflict instead of silently losing the RIR.

The preview reports added, updated, unchanged, and conflicted sessions. Invalid rows show reasons and require explicit partial-import approval. **Settings & data** records bounded import history and can undo the latest import for your account.

The CSV export uses a Hevy-style, one-row-per-set structure with explicit RIR, measurement/load/rep convention, and effort-source columns.

## Import nutrition from Fitatu

1. In Fitatu Premium or Premium+AI, open the data export and choose **CSV** ([official Fitatu export overview](https://www.fitatu.com/en/help/how-does-the-%22data-export%22-feature-work)).
2. Select **Import Fitatu CSV** in **Body metrics**, or choose **Import file → Meals and nutrition**.
3. Review the normalized daily totals, rejected rows, and the added/updated/unchanged preview.
4. Merge corrected days safely or replace only the previously imported Fitatu nutrition.

Liftwise recognizes Polish and English headings, comma/semicolon/tab separators, decimal commas, product rows, meal totals, and daily totals. It stores one record per calendar day with calories, protein, carbohydrates, fat, and optional fiber. When total rows are present, they take precedence so product rows are not counted twice. Future planned days and invalid values are rejected; importing valid rows requires explicit confirmation when a file is only partially accepted.

Re-importing the same date skips unchanged data and updates corrected values. The last import can be undone from **Settings & data**, and all Fitatu nutrition is included in the complete JSON backup. Imported nutrition is saved to your account and shown in **Body metrics** alongside the body-weight-based protein context.

## Body metrics

Open **Body metrics** to log a weight, a body-fat estimate, or both. The current cards identify the measurement date and the change since the first check-in; charts show up to the latest 12 daily check-ins, spaced by their actual dates. If a future Garmin sync provides a value on the same day, a manual value takes priority; multiple manual check-ins are kept in the history rather than discarded.

After weight is logged, the dashboard shows `1.6 g/kg/day` as a practical protein starting point and `1.4–2.0 g/kg/day` as context—not a personalized nutrition prescription. It does not estimate calories or claim protein can replace adequate training, food quality, or medical nutrition advice.

### Muscle progress map

Open **Progress → Muscles** for a front/back body map next to the ranked
muscle-coverage list. Use the week arrows to review a previous week; the map
and list always describe the same selected week. Each muscle is colored by
whether this week's effective sets are below, within, or above your
configured range — the same three states already shown as text in the
ranked list, never color alone (each region carries a `✓`/`+`/`−` glyph and
an accessible label). Selecting a region highlights the matching row.

This is a simpler status view than earlier plans for this map: it does not
yet reproduce a multi-week "stalled progress" red state derived from
direct-exercise comparisons, only this-week coverage against your range. It
describes logged training, not visible muscle growth.

Body metrics are included in **Backup JSON** and its restore flow. They are deliberately not added to the Hevy-style workout CSV because that format is one row per exercise set, not a body-composition interchange format.

## Garmin Connect

Garmin is deliberately demoted to the Settings & data area. The data model can retain Garmin-sourced measurements, but Liftwise does not yet implement the Garmin OAuth flow itself. Garmin Connect API access requires approval through Garmin's developer program, and Garmin's OAuth flow needs secure server-side token exchange and storage. See Garmin's [developer-program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/), [Health API overview](https://developer.garmin.com/gc-developer-program/health-api/), and [OAuth 2.0 + PKCE specification](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE.pdf).

Liftwise now has its own small backend, which removes the original "no server exists" blocker, but the OAuth callback handling, encrypted token storage, and sync job described here are not implemented. Garmin-imported records are designed to carry a source ID so repeated syncs can be deduplicated once that work happens. Until then, manual check-ins are the safe working path.

## Coaching model and limits

The app treats volume ranges as starting points, not universal prescriptions. It does **not** diagnose injuries, estimate medical readiness, replace a coach, or claim an exercise is objectively best. Pain, health conditions, technique, recovery, access to equipment, and personal preference should override an automated prompt.

The main rules are transparent in the in-app "Method & sources" panel:

1. Use weekly working sets by muscle group as the main hypertrophy coverage signal.
2. Use RIR and a rep range to decide whether to add your configured load increment, hold steady, or reduce/manage fatigue.
3. Let a daily recovery check-in veto automatic "add more" advice; a pain concern pauses the generated session.
4. Filter new logging and recommendations to the equipment selected in the Training Profile.
5. Suggest exercises based on movement coverage, familiarity, and practical substitutions—rather than declaring one movement universally superior.
6. Keep basic recovery context visible: a general 7-hour adult sleep baseline and a protein starting point when body weight is known.
7. Compare only compatible measurement/load/repetition conventions; treat lower assistance as harder and timed/distance work separately.

The product is deliberately scoped to muscle-building guidance. "Training background" is stored as profile context, but it does not silently apply different targets or pretend that the same rules are a strength-sport program.

## How the next session is chosen

Liftwise always uses the currently selected calendar week and your editable muscle-set ranges. Each qualified non-warm-up working set gives its exercise's primary muscle(s) **1.0 effective set** and secondary muscle(s) **0.5 effective set**. For every muscle it calculates:

```text
gap = selected weekly minimum − effective sets already logged
```

When a routine is scheduled today, it becomes the next-session base and coverage gaps are optional adjustments. Without a scheduled routine, the largest positive gaps become candidates. Liftwise softly deprioritizes a muscle that had direct work in the last 48 hours, chooses familiar compatible movements, and caps a movement at three suggested sets. If no muscle is below its selected minimum, it suggests maintenance work for the least-covered muscles instead. Suggestions are filtered to enabled equipment.

For each muscle, Progress applies one deterministic planning rule: add at most **3 direct working sets** toward a gap, maintain inside the range, or review work above the range without calling it inherently harmful. Every card shows its inputs and a `WHY` statement. Load decisions use conservative double progression: every normal working set must reach the range ceiling with at least 1 RIR in two appearances no more than 28 days apart before the configured load jump is added. Two recent below-floor, 0-RIR appearances reduce external load by at least one usable increment or regress a bodyweight variation. Missing RIR/RPE results in a hold-and-log-effort prompt instead of an effort-based load change.

A caution or low-recovery check-in pauses set-addition advice, raises the suggested RIR target, and caps generated movements at two sets. A new or unusual pain concern disables the generated workout. These are transparent, user-controlled safety heuristics—not a validated readiness score or diagnosis.

The 1.0/0.5 direct/secondary-set accounting and the 3-set volume cap are transparent conservative heuristics—not a claim that every compound lift contributes identically to every muscle. Pain, recovery, technique quality, and individual coaching direction override the app.

## Home-gym defaults

The default profile enables adjustable dumbbells, a barbell, flat bench, and pull-up/dip bar. Squat-rack and incline-bench movements stay hidden until you enable them, because a bench-press setup alone should not be assumed safe for back squats. The **Machine: off** chip can reveal machine movements for reference; they remain unavailable for new logging and recommendations until machine access is enabled in the profile.

Open **Why this session?** in the dashboard to see every current-week planning input. In **Workouts**, open any workout and choose **Add / edit RIR** to record per-set RIR without changing load, reps, set type, raw RPE, or import metadata. Only changed fields become manual overrides, and those RIR values survive corrected CSV imports. Manual workouts expose the full session editor; imported source-controlled values remain read-only.

## Research used

- [ACSM 2026 resistance training position stand](https://pubmed.ncbi.nlm.nih.gov/41843416/) — resistance training prescription for healthy adults, including the role of higher weekly volume for hypertrophy.
- [WHO physical activity guideline recommendations](https://www.ncbi.nlm.nih.gov/books/NBK566046/) — muscle-strengthening work involving major muscle groups on two or more days per week.
- [Systematic review on exercise variation](https://pubmed.ncbi.nlm.nih.gov/35438660/) — supports purposeful, not excessive/random, exercise variation.
- [Meta-regression on proximity to failure](https://pubmed.ncbi.nlm.nih.gov/38970765/) — RIR/proximity to failure is useful context, but the app avoids a simplistic "always train to failure" rule.
- [2026 volume/frequency meta-regression](https://pubmed.ncbi.nlm.nih.gov/41343037/) — supports treating direct and indirect work as separate inputs and using volume as an individual starting point rather than a universal prescription.
- [Meta-analysis on inter-set rest intervals](https://pubmed.ncbi.nlm.nih.gov/39205815/) — supports resting long enough to preserve useful work rather than enforcing a universal short timer.
- [Protein-supplementation meta-analysis](https://pubmed.ncbi.nlm.nih.gov/28698222/) — informs the displayed `1.6 g/kg/day` practical starting point while acknowledging large individual variation.
- [AASM/SRS adult sleep-duration consensus](https://aasm.org/resources/pdf/adultsleepdurationconsensus.pdf) — supports the visible general baseline of at least seven hours for healthy adults.

## File map

Frontend (`src/`):

- `index.html`, `src/app.js`, `src/domain.js`, `src/ui/import-chooser.js` — the legacy, browser-only interface (`localStorage` only; not connected to the server — see **Legacy interface** above).
- `src/main.js`, `src/app/main.tsx`, `src/app/App.tsx` — Vite entry points; `App.tsx` owns the sign-in gate, data loading, and routing for the modern interface.
- `src/domain/` — pure, tested domain rules (effort, import, coaching, optimization, progress, body trend, shared date helpers in `dates.ts`) with no DOM or storage access, shared by the frontend and the server.
- `src/infrastructure/local-storage/` — the workout-draft repository (still local; drafts autosave to the browser until a workout is finished).
- `src/infrastructure/remote/` — the API client: `storage-repository.ts` (data load/save/import-undo), `auth-client.ts` (login/logout/session), `compare-client.ts` (friend comparison).
- `src/features/` — one folder per primary destination (`today`, `train`, `progress`, `body-nutrition`, `library`, `compare`, `settings`, `auth`).
- `src/styles.css`, `src/app/styles.css` — visual system for the legacy and modern interfaces respectively.
- `src/pwa.js`, `vite.config.js`, `public/icons/` — installable/offline app-shell and update flow, plus the `/api` dev proxy.

Backend (`server/`):

- `server/index.ts` — process entry point; starts the HTTP listener.
- `server/app.ts` — the Express app: session middleware, auth routes, and all `/api/*` routes.
- `server/db.ts` — SQLite connection and schema (`users`, `kv_store`, `sessions`, `request_logs`).
- `server/auth.ts`, `server/session-store.ts` — password hashing/verification and the SQLite-backed session store.
- `server/storage-port.ts` — adapts SQLite to the same `StoragePort` interface the browser's `localStorage` repository implements, so `LiftwiseStorageRepository` runs unchanged on the server.
- `server/traffic-log.ts` — request logging middleware (writes to `request_logs`).
- `server/scripts/create-user.ts` — admin CLI for creating or resetting an account.

Deployment (`deploy/`, see [`DEPLOYMENT.md`](DEPLOYMENT.md)):

- `deploy/liftwise.service` — systemd unit for running the backend under a dedicated `liftwise` user.
- `deploy/nginx-liftwise.conf` — Nginx site config (reverse-proxies `/api`, serves `dist/`, certbot-ready).

Tests:

- `test/` — Vitest domain, storage-schema, and server (`server.test.ts`, via `supertest`) tests.
- `e2e/` — Playwright end-to-end tests that run the real API server and frontend together (see `playwright.config.ts`).
