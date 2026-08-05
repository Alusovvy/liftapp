# LiftWise product transformation plan

Status: **proposal — implementation is blocked until explicit approval**

Prepared: 2026-08-02  
Scope: information architecture, behavior design, visual communication, coaching logic, accessibility, engineering migration, testing, and rollout  
Current product basis: the data and rules already present in this repository

---

## 1. Executive decision

LiftWise should become a **decision-support training coach**, not a dashboard that asks the user to interpret many equally prominent metrics.

Every important screen should answer three questions in this order:

1. **What is the best next action?**
2. **Why is that the recommendation?**
3. **What evidence and rules produced it?**

The transformation should preserve the product's strongest current qualities:

- local-first ownership and offline use;
- transparent, deterministic coaching rules;
- editable routines and exercise choices;
- safe handling of pain and poor recovery;
- detailed workout provenance, including imported values;
- Fitatu nutrition and body measurements as context, not moral judgment;
- backup, restore, import preview, and undo.

The transformation should remove or reduce:

- many cards competing at the same visual level;
- long explanations before the user knows what to do;
- status colors without a clear action;
- repeated information across Overview, Insights, and Body;
- charts that look precise when the underlying evidence is sparse;
- expert terminology where a short action would work better;
- monolithic UI code that makes small product changes risky.

The recommended implementation is an **incremental React + TypeScript migration inside the existing Vite application**, with the current storage schema and domain behavior protected by characterization tests. It is not a big-bang rewrite.

---

## 2. Product north star

### Product promise

> Open LiftWise and know what to do next, why it fits your recent training and recovery, and how to adjust it without losing control.

### Primary jobs to be done

| Moment             | User job                                        | Product response                                                                  |
| ------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Before training    | “What should I train today?”                    | One recommended session or recovery action, one reason, and alternatives          |
| During training    | “What should I do for this set?”                | Previous performance, current target, fast logging, and a conservative adjustment |
| After training     | “Did that move me forward?”                     | A brief outcome summary and at most one important next-time change                |
| During the week    | “What area needs attention?”                    | No more than three ranked weekly priorities                                       |
| Reviewing progress | “Am I improving, and is there enough evidence?” | Trend plus evidence sufficiency, not a binary success/failure label               |
| On a difficult day | “How can I adapt safely?”                       | A reduced or postponed option without guilt or catch-up pressure                  |
| After a lapse      | “How do I restart?”                             | Start from today; do not punish, backfill, or create a recovery debt              |

### Success definition

The product succeeds when users can make and record a sound training decision quickly. It does **not** succeed merely because they spend more time in the app, open it more often, or preserve a streak.

---

## 3. Research translated into product rules

This section separates evidence from product judgment. The research supports design directions; it does not prove that one exact interface is universally optimal.

### 3.1 Behavioral psychology

| Evidence                                                                                                                                                                                                                                            | Product implication                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A meta-analysis of 138 studies found that progress monitoring interventions improved monitoring and goal attainment, with stronger effects when outcomes were recorded or reported.                                                                 | Make logging fast, show progress against a chosen plan, and close the loop after a workout. Do not hide recorded behavior behind decorative summaries. |
| Self-determination research in exercise associates autonomous motivation and perceived competence with continued participation.                                                                                                                     | Use autonomy-supportive language and always provide a practical alternative. Recommendations are suggestions, not commands.                            |
| Reviews of digital behavior-change interventions repeatedly identify self-monitoring, feedback, goal setting, planning, and personalization, while also showing that effectiveness varies and causal evidence for individual techniques is limited. | Use a small, explicit set of techniques and test comprehension and usefulness. Do not add engagement mechanics simply because they are common.         |
| Implementation-intention research supports specific action plans, particularly when plans are reinforced.                                                                                                                                           | Allow “When / where / what” planning for the next session, but keep reminders opt-in and user controlled.                                              |
| Personal-informatics research describes a path from preparation and collection through integration, reflection, and action, with failures in one stage affecting later stages.                                                                      | Show missing-data states, explain what cannot yet be concluded, and make every insight lead to an available action.                                    |

### Behavioral techniques to use deliberately

- Self-monitoring of completed sessions, sets, effort, and optional recovery/body/nutrition data.
- Feedback on behavior and outcome, clearly distinguished.
- Goal setting through routines, training days, and muscle-dose targets selected or confirmed by the user.
- Action planning for the next workout.
- Graded tasks through reduced-session options when recovery is limited.
- Prompts and cues only when the user explicitly enables them.
- Review of goals when the data repeatedly conflicts with the current plan.

### Behavioral techniques not to use

- Streak loss, shame, or “you failed” language.
- Variable rewards, loot-box patterns, or celebration frequency designed to create compulsive checking.
- Public rankings or social comparison.
- A hidden algorithmic score that tells users they are “ready” or “unready.”
- Automatic escalation of goals after success.
- Notifications enabled by default.

### 3.2 Information and visual design

Graphical-perception research indicates that people compare position on a common scale more accurately than angle or area. Accessibility standards require content to reflow, controls to have adequate target sizes, and meaning not to depend on color alone.

Therefore:

- Prefer lines, dots, bars, and target bands on common axes.
- Avoid radar charts, gauges, and donut charts for precise comparisons.
- Never use a body heat map as the only quantitative muscle view; pair it with a ranked text/table view.
- Show raw observations and the trend together when space permits.
- Use labels next to values rather than a distant legend.
- Provide a text or table equivalent for every meaningful chart.
- Use red only for safety, pain, invalid data, or destructive errors—not ordinary under-target training.
- Pair every color state with text and, where helpful, an icon.
- Put the conclusion in the heading; do not force chart interpretation before stating the point.

### 3.3 Training and health boundaries

Current exercise evidence supports resistance training as beneficial and indicates that program variables such as volume, frequency, effort, and rest matter, but individual response and study uncertainty make highly precise universal prescriptions inappropriate.

Therefore:

- Retain rule-based, conservative suggestions.
- Describe weekly muscle targets as configurable planning ranges, not medical truth.
- Keep RIR provenance and missing-effort handling visible.
- Use “evidence sufficiency” instead of a numeric confidence percentage.
- Never diagnose injury, illness, overtraining, or nutrition deficiency.
- Pain responses should stop or modify the recommendation and advise appropriate professional help when warranted.
- Nutrition should be descriptive unless the user has explicitly entered a goal. Do not label food “good,” “bad,” “clean,” or “cheating.”
- Health and performance claims must remain modest and supportable.

---

## 4. Current product audit

### 4.1 Existing information architecture

The current primary areas are:

1. Overview
2. Workouts
3. Coach insights
4. Body metrics
5. Library

The data model already covers:

- profile and configurable targets;
- custom exercises, aliases, favorites, equipment preferences, and routines;
- workout sessions and set-level load, repetitions, duration, distance, RPE/RIR, and provenance;
- import batches with preview/undo behavior;
- body weight and body-fat measurements;
- Fitatu daily calories, protein, carbohydrates, fat, and fiber;
- recovery check-ins for sleep, energy, soreness, stress, and pain;
- local integrations and application metadata.

The domain logic already provides:

- Monday-to-Sunday weekly summaries;
- primary and secondary muscle-dose weighting;
- weekly target gaps and suggestion ranking;
- 48-hour recent-work deprioritization;
- equipment-aware exercise selection;
- recovery-based reduction, higher-RIR guidance, or pain pause;
- conservative double-progression suggestions;
- mode-aware suggestions for load/repetitions, assisted load, duration, and distance;
- muscle states that require evidence before showing a strong negative conclusion;
- Fitatu recent-day and rolling nutrition summaries;
- body-measurement trends.

### 4.2 What is working

- The calculations are explainable and more cautious than many “AI coach” products.
- The user can inspect and edit the underlying data.
- Imports preserve source sessions instead of silently synthesizing history.
- Missing effort is not silently treated as a successful high-quality set.
- Pain is treated as a stop condition.
- The application works without requiring an account or cloud backend.
- Text tables and explicit explanations already exist in several places.

### 4.3 Core usability problem

The product computes useful signals but often gives them equal prominence. A user may see weekly dose, recovery, momentum, muscle coverage, session rhythm, a next-session suggestion, and detailed explanations at once. The interface answers “What data exists?” better than “What should I do now?”

The redesign should not remove rigor. It should change the order:

```text
Action → concise reason → alternatives → evidence → calculation detail
```

---

## 5. Target information architecture

### 5.1 Recommended navigation

| Primary destination  | Purpose                                              | Secondary areas                                           |
| -------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| **Today**            | Decide and start the next useful action              | Recovery check, today's plan, weekly focus, recent change |
| **Train**            | Plan, perform, and review workouts                   | Live workout, routines, history, import                   |
| **Progress**         | Understand performance and training coverage         | Focus, exercises, muscles, recovery                       |
| **Body & nutrition** | Review optional context from measurements and Fitatu | Body trend, nutrition                                     |
| **Library**          | Find, compare, and manage exercises                  | Catalog, favorites, custom exercises                      |

Move settings, profile, targets, equipment, data backup/restore, integrations, and app information into a consistent **Settings & data** area accessed from the profile/menu control.

On mobile, use a bottom navigation for the five primary destinations. On wider screens, keep a left rail. The destination names and order must remain identical across breakpoints.

### 5.2 Why this structure

- “Today” names the user's immediate decision rather than the generic “Overview.”
- “Train” groups routines, live logging, history, and workout import into one mental model.
- “Progress” replaces “Coach insights” with a user outcome and contains both exercise progression and muscle coverage.
- Body measurements and nutrition are contextual inputs and belong together, but remain visually distinct.
- Library remains stable because it is a separate browse/manage task.

---

## 6. The attention and recommendation model

### 6.1 Do not create a focus score

A single score would combine unlike inputs, conceal value judgments, and suggest false precision. Use a deterministic **priority ladder** instead.

### 6.2 Priority ladder

Evaluate in this order:

1. **Safety:** current pain or another explicit stop condition.
2. **Recovery constraint:** recovery check indicates a reduced or postponed session.
3. **Planned action:** a routine is scheduled or explicitly selected for today.
4. **Data quality:** a missing baseline prevents a useful recommendation.
5. **Weekly plan gap:** largest relevant muscle-dose gap, adjusted for recent work and available equipment.
6. **Performance issue:** a well-supported stall or repeated hard miss.
7. **Above-plan review:** volume repeatedly exceeds the user's configured range.
8. **Maintenance:** everything material is on plan; continue or choose a preferred session.

The ladder is lexicographic: a safety condition cannot be outweighed by a large weekly deficit.

### 6.3 Outputs

The model produces:

- one **primary action for today**;
- zero to three **weekly focus items**;
- an **evidence sufficiency** label;
- a short reason;
- optional detailed evidence;
- at least one alternative when an action is suggested.

### 6.4 Evidence sufficiency

Use plain-language categories with defined criteria:

| State               | Meaning                                                                                | UI behavior                                               |
| ------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Need data**       | The required baseline or recent observations are absent                                | Ask for the smallest useful input; do not infer a trend   |
| **Emerging**        | Some relevant data exists, but the current rule's full comparison window is incomplete | Show the observation and what would make it more reliable |
| **Enough evidence** | The rule's documented comparison requirements are met                                  | Show the recommendation and make exact evidence available |

This label refers to the data available for the specific recommendation. It is not a general score for the user or workout.

### 6.5 Recommendation card contract

Every actionable card uses this anatomy:

```text
[State / timing]
Action verb + target + dose
One-sentence reason

[Primary action]  [Adjust or swap]  [Not today]

Evidence: Emerging ▾
```

Example:

```text
TODAY · PLANNED
Train Lower A — about 42 min
Quads are 4 weighted sets below your weekly range, and they have not had
direct work in 72 hours.

[Start workout]  [Adjust session]  [Choose another]

Evidence: Enough evidence ▾
```

Rules:

- One primary button per card.
- The heading contains the action, not the metric name.
- “Why” is one sentence by default.
- Expanded evidence includes dates, source sessions, calculation rule, and relevant target.
- A user can dismiss or choose an alternative without penalty.

---

## 7. Screen-by-screen transformation

### 7.1 Today

#### Question answered

“What is the most useful thing to do now?”

#### Information order

1. Current safety/recovery condition, only when relevant.
2. One primary today card.
3. Weekly focus: maximum three ranked items.
4. Compact week status.
5. Last session and what changed.
6. Detailed diagnostics below a disclosure or lower on the page.

#### Desktop wireframe

```text
┌──────────────────────────────────────────────────────────────────┐
│ Today · Sunday 2 Aug                         [Quick log] [Profile]│
├───────────────────────────────────────┬──────────────────────────┤
│ TODAY'S ACTION                        │ THIS WEEK                │
│ Train Lower A · about 42 min          │ 2 / 4 sessions          │
│ One concise reason                    │ Dose      ━━━━━━━░       │
│ [Start workout] [Adjust] [Choose]     │ Effort data 86%          │
│ Evidence: Enough evidence ▾           │ Updated after last set   │
├───────────────────────────────────────┴──────────────────────────┤
│ WEEKLY FOCUS                                                     │
│ 1 Quads · add 4 weighted sets   [Use in workout] [Why?]         │
│ 2 Back · establish effort data  [Review sets]    [Why?]         │
│ 3 Sleep · recovery context      [Check in]       [Why?]         │
├──────────────────────────────────────────────────────────────────┤
│ LAST SESSION · Upper A · yesterday                               │
│ Bench press improved by 1 rep; keep the same load next time.     │
│ [Review workout]                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### Mobile behavior

- Stack the same content in the same priority order.
- The primary action and button must be visible without horizontal scrolling.
- Weekly focus becomes a vertical list, not a carousel.
- Keep the primary workout action available in a sticky bottom action only after it has scrolled out of view.
- Do not duplicate two competing “Start” buttons on screen at once.

#### Week status

Show a compact progress strip rather than a wall of metric cards:

- completed / planned sessions;
- muscle-dose coverage across configured ranges;
- RIR/effort data completeness;
- most recent data timestamp.

Each item opens its relevant detailed view.

#### Empty and exceptional states

- No routines: “Create a routine or choose exercises for a one-off workout.”
- No workout history: start from a preferred routine; do not pretend to personalize progression.
- Recovery check missing: recommendation can continue, with a lightweight optional check-in.
- Pain selected: replace the training CTA with “Review pain response”; no generated training session.
- Week complete: suggest a planned preferred session or recovery, not extra volume to preserve activity.
- Returning after a lapse: “Welcome back. Start from today”; do not show overdue debt.

---

### 7.2 Train

#### Sub-navigation

1. **Workout** — current live workout or start selection
2. **Routines**
3. **History**
4. **Import**

#### Live workout mode

The logging flow should be a focused workspace rather than a modal layered over the dashboard.

##### Exercise header

- exercise name;
- target prescription;
- compact previous-session result;
- current progression suggestion;
- swap and notes controls.

##### Set row

Show only fields relevant to the exercise mode:

- load + repetitions + RIR for normal strength sets;
- assistance + repetitions + RIR for assisted exercises;
- duration and/or distance for time/distance exercises;
- set type only when it differs from the default.

RIR defaults to the domain/import behavior already approved: **3 when not provided**, while preserving provenance so an inferred default is distinguishable from an explicit entry.

Advanced metadata and raw imported values live in a disclosure. They should remain editable and auditable, but not slow ordinary logging.

##### Interaction requirements

- Minimum 44 × 44 CSS-pixel preferred touch targets for primary logging controls.
- Numeric keyboard hints on mobile.
- Save locally after each meaningful edit.
- Clear saved/sync state: “Saved on this device.”
- Undo for set deletion and exercise removal.
- Keyboard-operable add set, next field, complete set, and complete workout.
- No animation that delays entry; honor reduced-motion preference.
- Keep the next set and primary action near the thumb zone on mobile.
- A user can finish an incomplete workout and clearly see what was omitted.

#### During-workout recommendation

Display the recommendation adjacent to the input it informs:

```text
Previous: 70 kg × 8 @ 2 RIR
Today: keep 70 kg; aim for 9 reps around 2–3 RIR
```

Do not place the entire progression explanation above every set. “Why?” reveals the exact source sessions and rule.

#### Completion screen

Use a short debrief:

- completed dose and exercises;
- best supported improvement;
- missing effort data, if material;
- at most one change to consider next time;
- edit and review buttons.

Celebration should acknowledge the action without exaggerating its meaning. Avoid confetti loops, level-ups, or claims that one workout transformed a trend.

#### Routines

- Put next scheduled / recently used routines first.
- Show estimated duration from the user's actual history when enough data exists; otherwise label it as a rough estimate.
- Show muscle emphasis in text, not only body-map color.
- Make duplicate, edit, reorder, and archive available without overcrowding the main card.

#### History

- Default to a chronological list grouped by date.
- Search and filters stay available but collapse on small screens.
- Each row answers: what, when, duration, completion, and key change.
- Imported provenance is a quiet badge.
- Editing a historical session explicitly states which current recommendations may update.

#### Import

- Keep the explicit choice between **Workout import** and **Meal / Fitatu import**.
- Use a four-step flow: choose type → select file → preview → confirm.
- Never open a file picker before the type is chosen.
- Show recognized rows, skipped rows, warnings, duplicates, and date range before commit.
- Import errors include a corrective action and retain the preview.
- Keep import-batch undo and source-file metadata.

---

### 7.3 Progress

#### Question answered

“What is changing, what deserves attention, and how strong is the evidence?”

#### Sub-navigation

1. **Focus**
2. **Exercises**
3. **Muscles**
4. **Recovery**

#### Focus

This is the detailed home for the weekly priority list. Each item includes:

- action;
- reason;
- affected routine/exercises;
- target versus current value;
- recent-work adjustment;
- evidence sufficiency;
- direct action such as “Add to next workout,” “Review target,” or “Log baseline.”

Maximum three active priorities. Lower-ranked observations belong under “Other observations” and must not compete for attention.

#### Exercise progress

Default list order:

1. actionable progression decisions;
2. emerging changes;
3. maintained exercises;
4. exercises needing a baseline.

Each exercise row shows:

- next recommendation;
- last comparable performance;
- compact trend;
- evidence sufficiency;
- last trained date.

Detailed view includes comparable set history and explains why sets were included or excluded. Load, repetitions, RIR, duration, and distance must not be merged into one opaque score.

#### Muscle coverage

Use a ranked list with a common horizontal scale and target band:

```text
Quads       6 ━━━━━━░░░░ [target 10–14]  Below range
Back       12 ━━━━━━━━━━━━ [10–16]       In range
Chest      18 ━━━━━━━━━━━━━━━━━━ [8–14]  Review above range
```

The body map may remain as an exploratory navigation aid:

- selecting a region filters the ranked list;
- a label and value appear on focus/hover;
- the map is never the only presentation;
- ordinary under-target status uses amber/neutral, not red.

Keep the current conservative stall rule, but phrase it as a review:

> “Performance has not improved across three comparable hard sessions. Review load, recovery, technique, or exercise choice.”

Do not claim the muscle itself is physiologically “stalled.”

#### Recovery

- Show recovery inputs over time and their relationship to session adjustments.
- Do not infer medical conditions or causal claims from correlations.
- Distinguish “you reported” from “the app adjusted.”
- Explain exactly how today's recommendation changed.
- Allow a check-in to be corrected.

---

### 7.4 Body & nutrition

#### Body trend

Show:

- latest measurement and date;
- raw measurements;
- a trend only when there is enough data;
- selected time window;
- optional user-entered reference or goal range.

Rules:

- Never color weight change green or red by default.
- Use neutral language: increased, decreased, stable, insufficient data.
- State the trend method and window.
- Do not interpolate body-fat values where they were not measured.
- Flag likely entry errors for review, but never silently delete or correct them.

#### Nutrition

Fitatu information should answer:

1. What was imported most recently?
2. What does the recent average look like?
3. How complete is the period?

Recommended header:

```text
Recent nutrition · 4 of the last 7 days imported
Protein 146 g average · Calories 2,410 kcal average
Latest import: 2 Aug, 08:42
```

Rules:

- Show completeness beside every rolling average.
- Do not treat missing days as zero.
- Separate the most recent day from the rolling average.
- Show calories, protein, carbohydrates, fat, and fiber with units.
- If the user enters a target, show the target as user-configured.
- Do not prescribe a calorie deficit/surplus or protein target without an explicit, carefully scoped feature and evidence review.
- Keep meal-level details available for audit if imported, but start with daily summaries.
- Label source and import batch.

#### Relationship to training

Nutrition and body measurements can be offered as context in evidence details, but must not automatically override safety, recovery, or the training plan. Avoid causal statements such as “low protein caused your stalled bench.”

---

### 7.5 Library

#### Main improvements

- Preserve equipment, muscle, favorite, and availability filters.
- Add contextual entry points from recommendations: “Choose a quad exercise available with your equipment.”
- Explain why an exercise is recommended: primary muscle, secondary muscle, equipment, familiarity, and recent use.
- Keep search visible and filters summarized as removable chips.
- Separate browse cards from exercise-management actions.
- Retain compact and comfortable density preferences.

#### Exercise detail

- description and setup;
- primary/secondary muscles;
- equipment;
- measurement mode;
- routines using it;
- recent performance;
- aliases/import matching;
- edit/customize actions.

Do not attach an unvalidated “best exercise” score.

---

### 7.6 Settings & data

Group settings by user intent:

- Profile and units
- Training plan and targets
- Equipment and preferences
- Recovery preferences
- Integrations and imports
- Backup, restore, and data export
- Accessibility and display
- About the coaching rules

High-risk actions require a preview or confirmation. Backup and export should be visibly available before restore/reset operations.

---

## 8. Content design

### Voice

Calm, concise, specific, and autonomy-supportive.

| Avoid                           | Prefer                                                                   |
| ------------------------------- | ------------------------------------------------------------------------ |
| “You failed to hit your target” | “4 weighted sets remain in your weekly range”                            |
| “You must train back today”     | “Back is the largest current gap; add it today or choose another day”    |
| “Bad recovery”                  | “Recovery looks limited based on your check-in”                          |
| “Perfect workout!”              | “Workout saved. Bench press improved by 1 rep.”                          |
| “You are overtraining”          | “Chest volume is above your configured weekly range”                     |
| “Low confidence: 63%”           | “Emerging: one more comparable session will complete the current window” |
| “Get back on track”             | “Start from today”                                                       |

### Recommendation writing template

1. Action in 8–12 words.
2. Reason in one sentence.
3. Evidence label.
4. Optional calculation details.
5. Primary action plus an alternative.

### Terminology

- Define “weighted set,” “primary,” “secondary,” and “RIR” on first use and keep a glossary.
- Prefer “weekly range” over “optimal volume.”
- Prefer “comparison sessions” over “performance score.”
- Prefer “review” over “warning” unless data is invalid or safety is involved.

---

## 9. Visual system

### Hierarchy

- One page title and one dominant action region.
- Maximum one filled primary button in each visible decision region.
- Key recommendation heading: 24–32 px depending on viewport.
- Body copy: 16 px minimum default.
- Metadata: 13–14 px minimum, with sufficient contrast.
- Reading width: roughly 65–75 characters for explanations.
- Use spacing and grouping before borders and background colors.

### Semantic tokens

Define design tokens rather than hard-coded component colors:

- `surface`, `surface-raised`, `text`, `text-muted`, `border`;
- `accent`, `accent-contrast`;
- `status-on-plan`, `status-review`, `status-safety`, `status-info`;
- focus ring, target band, chart series, imported-source badge;
- spacing, radius, shadow, typography, and motion duration.

Status semantics:

- **Red:** pain, invalid data, blocked destructive action, or a genuine safety message.
- **Amber:** review, limited recovery, incomplete evidence, above/below configured range.
- **Green:** in configured range or completed—not “healthy” or morally good.
- **Blue/neutral:** information, imported source, data collection.

### Charts

Every chart needs:

- an insight-led title;
- axes, units, and time range;
- direct labels where practical;
- raw-data access;
- data completeness;
- empty, loading, and error states;
- keyboard/screen-reader accessible summary;
- a tabular alternative for consequential data.

### Responsive behavior

Design and test at 320, 375, 768, 1024, and 1440 CSS pixels. Content order must remain logical under reflow. No meaningful two-dimensional scrolling except a genuinely tabular data region with an accessible alternative.

### Accessibility acceptance target

- WCAG 2.2 AA.
- Visible keyboard focus that is not obscured by sticky UI.
- Semantic headings and landmarks.
- Proper labels, descriptions, errors, and status announcements.
- Minimum 24 × 24 CSS-pixel WCAG target requirement, with 44 × 44 preferred for workout controls.
- No color-only meaning.
- Reduced motion support.
- Text zoom to 200% and content reflow without loss.
- Dialog focus containment and reliable return focus.
- Charts summarized in nearby text.

---

## 10. System states that must be designed

Each transformed screen must explicitly cover:

- first run;
- sparse real data;
- enough real data;
- demo/sample data;
- imported workout data;
- imported Fitatu data;
- partly recognized import;
- duplicate import;
- offline/PWA mode;
- corrupted or incompatible local data;
- recovery caution;
- pain stop;
- user correction of a past entry;
- empty search/filter result;
- reduced-motion mode;
- keyboard-only use;
- narrow mobile screen.

Demo data must be visually labeled and must never blend silently into real recommendations.

---

## 11. Technical architecture recommendation

### 11.1 Direction

Adopt **React + TypeScript incrementally on the existing Vite foundation**.

Why:

- the application has multiple stateful screens and repeated UI patterns;
- the current `src/app.js` and `index.html` are large and tightly coupled;
- TypeScript can expose data-shape and unit mismatches before runtime;
- component boundaries allow accessible behaviors to be implemented and tested once;
- Vite, Vitest, PWA behavior, and local-first deployment can remain;
- no server framework is needed for the current local-only product.

React's own documentation recommends a broader framework for many new products, but this application has a specific client-only, local-storage, offline constraint and already uses Vite. Introducing a server/full-stack framework would add migration and deployment complexity without solving a current user problem.

### 11.2 Migration pattern

Use a strangler migration:

```text
Existing storage + domain rules
              │
      typed repository adapter
              │
       pure selectors/view models
              │
      ┌───────┴────────┐
 legacy DOM UI    new React UI
      └───────┬────────┘
         same saved data
```

Never let both UIs write incompatible versions of the schema. Each migrated destination replaces its legacy counterpart only after acceptance tests pass.

### 11.3 Proposed source structure

```text
src/
  app/
    App.tsx
    routes.tsx
    providers/
  components/
    actions/
    charts/
    feedback/
    forms/
    layout/
  domain/
    coaching/
      attention-engine.ts
      evidence-sufficiency.ts
      progression.ts
      recovery.ts
      weekly-dose.ts
    import/
      fitatu.ts
      workouts.ts
    models/
    selectors/
  features/
    today/
    train/
    progress/
    body-nutrition/
    library/
    settings/
  infrastructure/
    local-storage/
    backup/
    pwa/
  styles/
    tokens.css
    global.css
  test/
    fixtures/
    builders/
```

The exact file split may evolve, but dependencies should point inward:

```text
features/UI → selectors/view models → domain rules → typed models
infrastructure → adapters/interfaces ← domain
```

Domain calculations must not query DOM elements or directly read local storage.

### 11.4 State management

- Start with React context plus reducer/hooks for app-level state.
- Keep persistent writes behind one repository interface.
- Keep derived values in pure selectors.
- Do not add a large external state library until profiling or complexity demonstrates a need.
- Use a runtime schema validator at storage/import boundaries; TypeScript alone does not validate stored JSON or CSV.
- Version the stored schema and provide explicit, tested migrations.

### 11.5 Chart implementation

Begin with accessible HTML and small SVG components for the limited chart set. Add a chart library only after the required interactions and accessibility support are specified. This avoids inheriting inaccessible defaults or a large bundle for decorative charts.

### 11.6 Privacy and data handling

- Remain local-first by default.
- Do not add analytics, crash upload, accounts, or cloud sync as part of this transformation.
- If telemetry is later considered, require a separate proposal, explicit opt-in, data minimization, retention rules, and a user-visible export/delete path.
- Never send health, body, workout, or nutrition data to a third party without explicit informed action.
- Keep all backup formats documented and portable.

---

## 12. Testing strategy

### 12.1 Preserve the current baseline

Before changing behavior:

- keep the current 24 tests passing;
- capture representative storage fixtures;
- capture current outputs for weekly dose, progression, recovery, Fitatu import, workout import, and muscle-state rules;
- verify backup → reset test store → restore round trip;
- use the supplied Fitatu sample as a permanent parser fixture with personal values minimized where practical.

### 12.2 Test pyramid

#### Domain unit tests

Table-driven tests for:

- priority ladder ordering;
- evidence sufficiency;
- weekly boundary and timezone behavior;
- primary/secondary muscle weighting;
- recent-work adjustment;
- progression by measurement mode;
- explicit, missing, defaulted, cleared, and imported RIR;
- recovery caution and pain stop;
- Fitatu parsing, decimal conventions, missing days, duplicates, and undo;
- workout import source grouping and duplicate handling;
- body trend sufficiency and outlier review.

#### Component tests

Use Testing Library's user-centered approach:

- recommendation card action and disclosure behavior;
- keyboard navigation;
- dialogs, error summaries, and focus return;
- live set entry;
- import type chooser and file selection;
- chart summary/table switch;
- all important empty and error states.

#### Accessibility automation

- axe checks on each major state;
- semantic landmark and heading assertions;
- accessible-name checks for icon buttons and chart controls;
- focus-order tests for workout logging and imports.

Automated checks do not replace manual screen-reader, zoom, high-contrast, keyboard, and reduced-motion review.

#### End-to-end tests

Use Playwright for critical journeys:

1. First run → create routine → start → log → finish.
2. Recovery caution → choose reduced workout.
3. Pain response → training generation is blocked.
4. Import workout CSV → preview → confirm → undo.
5. Import Fitatu CSV → preview → confirm → nutrition completeness shown.
6. Edit historical set → affected recommendation updates.
7. Backup → restore → exact important data retained.
8. Install/offline reload → record workout → data survives.
9. Mobile 320 px → complete a workout without horizontal page scrolling.
10. Keyboard-only → complete the core workout and import flows.

#### Visual regression

Capture approved reference states at mobile, tablet, and desktop for:

- Today with enough data;
- Today with recovery caution;
- Today with pain stop;
- live workout;
- sparse Progress;
- Fitatu nutrition;
- import preview;
- long translated/large-text content.

### 12.3 Quality gates

Each phase must pass:

- type checking;
- lint/format checks introduced with the migration;
- existing and new unit tests;
- production build;
- critical Playwright journeys relevant to the phase;
- automated accessibility checks;
- manual keyboard and 320 px review;
- storage/backup compatibility tests.

Coverage thresholds protect risk-heavy domain modules, not vanity percentages. New coaching/domain modules should target at least 90% branch coverage; presentational components are judged primarily by behavior tests.

---

## 13. Validation with users

### Research sessions

Run five to eight moderated task-based sessions per major iteration with a mix of:

- a new lifter;
- a consistent recreational lifter;
- a data-oriented experienced lifter;
- someone returning after a lapse;
- at least one keyboard, zoom, or assistive-technology user where recruitment permits.

Use realistic seeded data and ask participants to:

1. Decide what to do today.
2. Explain why the app suggested it.
3. Modify the session because recovery is limited.
4. Log one exercise.
5. Find what to focus on this week.
6. Decide whether an exercise is improving.
7. Import a Fitatu file.

Measure:

- task completion without help;
- time to first correct action;
- recommendation comprehension;
- ability to locate evidence;
- logging errors;
- perceived autonomy and trust;
- accessibility barriers;
- exact moments of hesitation.

Do not use “Which design do you like?” as the primary evidence. Observe decisions and comprehension.

### Product outcome metrics

Because the app is local-first, these should be measured in structured usability studies or an explicitly opt-in local diagnostic mode, not covert analytics.

Targets to validate:

- median time to identify today's action: under 10 seconds;
- at least 80% can accurately explain the primary reason;
- at least 80% can find and understand the evidence label;
- median time to record a normal set: under 8 seconds after learning the UI;
- at least 90% complete workout and Fitatu import tasks without a dead end;
- fewer than 5% of observed set entries require correction caused by UI ambiguity;
- 100% of pain-state tests block generated training;
- no loss or mutation of existing saved data during migration.

Avoid optimizing:

- time in app;
- raw daily opens;
- notification click-through rate;
- uninterrupted streak length;
- number of cards viewed.

---

## 14. Delivery phases and approval gates

No phase starts until this document is approved. Each later phase ends with a reviewable, working state.

### Phase 0 — baseline and safety net

Deliver:

- typed description of the current persisted schema;
- anonymized representative fixtures;
- characterization tests for all current coaching and import behavior;
- backup/restore compatibility test;
- documented current screenshots and critical journeys.

Acceptance:

- no visible product change;
- current data opens unchanged;
- all existing tests and new characterization tests pass.

### Phase 1 — domain boundary and attention engine

Deliver:

- storage repository adapter;
- extracted pure domain modules;
- priority ladder;
- evidence-sufficiency classifier;
- recommendation view models;
- rule/provenance explanation model.

Acceptance:

- new outputs match approved fixture expectations;
- safety always outranks training goals;
- no opaque aggregate score;
- existing UI remains operational.

### Phase 2 — design system and application shell

Deliver:

- React + TypeScript entry;
- tokens and accessible primitives;
- responsive Today/Train/Progress/Body & nutrition/Library shell;
- Settings & data entry;
- feature-controlled coexistence with legacy screens.

Acceptance:

- navigation works at all target widths and by keyboard;
- current storage remains the source of truth;
- no user data migration is required yet.

### Phase 3 — Today

Deliver:

- primary recommendation;
- recovery/safety state;
- maximum-three weekly focus list;
- week status strip;
- recent-session outcome;
- sparse, first-run, lapse, complete-week, and pain states.

Acceptance:

- task-based comprehension targets are met in formative testing;
- recommendation evidence is auditable;
- only one dominant action appears at a time.

### Phase 4 — Train and imports

Deliver:

- focused live workout;
- routines and history;
- workout and Fitatu import selection/preview/confirm/undo;
- completion debrief;
- keyboard and mobile logging.

Acceptance:

- both import paths pass fixture and end-to-end tests;
- no “Import file does nothing” path is possible without a visible error;
- set entry and workout completion meet usability targets;
- defaulted RIR remains traceable.

### Phase 5 — Progress

Deliver:

- Focus, Exercises, Muscles, and Recovery;
- accessible trends and target bands;
- body map as secondary navigation;
- evidence states and rule explanations.

Acceptance:

- users can distinguish observation, recommendation, and insufficient evidence;
- every visual has a text equivalent;
- no single synthetic performance/readiness score is introduced.

### Phase 6 — Body & nutrition, Library, Settings & data

Deliver:

- neutral body trends;
- Fitatu completeness-aware summaries;
- contextual exercise selection;
- reorganized settings, integrations, backup, and restore.

Acceptance:

- missing nutrition days are never treated as zero;
- body and nutrition copy passes content review;
- backup/export is easy to find before destructive data actions.

### Phase 7 — legacy removal and hardening

Deliver:

- remove replaced legacy DOM/render paths;
- performance and PWA audit;
- complete accessibility review;
- final storage migration rehearsal;
- updated README and functionality documentation.

Acceptance:

- all critical journeys pass on the final UI;
- a saved backup from the pre-transformation application restores correctly;
- no orphaned UI path or duplicate calculation remains;
- agreed browser/device support is verified.

---

## 15. Rollout and rollback

- Create a local Git savepoint before Phase 0 implementation.
- Keep commits phase-scoped and reversible.
- Use a local feature flag during coexistence, not a remote experiment system.
- Never destructively migrate the only copy of user data.
- Before any schema upgrade, make an automatic versioned local backup and offer export.
- If migration validation fails, retain the old data untouched and show a recoverable error.
- Remove legacy code only after the replacement has passed its acceptance gate.

---

## 16. Risks and controls

| Risk                                           | Control                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Rewrite breaks saved data                      | Adapter boundary, fixtures, versioned schema, round-trip and legacy-backup tests   |
| Simplification hides rigor                     | Progressive disclosure with dates, source sessions, rules, and raw values          |
| Recommendation feels controlling               | Alternatives, dismissibility, user-configured targets, autonomy-supportive copy    |
| Too many “focus” items recreate the dashboard  | Hard maximum of three; lower items under secondary observations                    |
| Health claims exceed evidence                  | Descriptive language, explicit uncertainty, no diagnosis or universal prescription |
| Color implies moral/safety meaning incorrectly | Fixed semantic tokens; red reserved for safety/error                               |
| Charts mislead with sparse data                | Evidence sufficiency, raw points, completeness, no trend before criteria           |
| React migration expands indefinitely           | Screen-by-screen strangler phases and explicit acceptance gates                    |
| Test coverage becomes a vanity goal            | Risk-based branch coverage plus user-journey and accessibility tests               |
| Product starts optimizing compulsion           | Outcome metrics exclude time-in-app, streaks, and notification clicks              |
| Imported/default RIR becomes indistinguishable | Preserve effort source/provenance through model, UI, backup, and tests             |

---

## 17. Explicit non-goals

This transformation does not include:

- medical diagnosis or injury treatment;
- an AI chatbot or generative training plan;
- an opaque readiness, health, or performance score;
- automatic calorie or macronutrient prescription;
- social feed, leaderboards, public challenges, or streak pressure;
- account system, cloud sync, remote analytics, or backend;
- wearable integrations without a real supported data source;
- visual decoration that has no decision or comprehension purpose.

These require separate product, evidence, privacy, and engineering proposals.

---

## 18. Approval checklist

Approval of this plan means approval of the following defaults:

- [ ] Product north star: decision-support coach
- [ ] Five-destination information architecture
- [ ] Priority ladder instead of an aggregate focus/readiness score
- [ ] Maximum three weekly focus items
- [ ] Progressive disclosure: action → reason → evidence
- [ ] Autonomy-supportive, non-shaming behavior design
- [ ] Neutral body/nutrition language and explicit completeness
- [ ] WCAG 2.2 AA target
- [ ] Incremental React + TypeScript migration on Vite
- [ ] No cloud, analytics, or account scope
- [ ] Phase gates, storage compatibility, and rollback requirements

Suggested approval wording:

> Approved. Implement `PRODUCT_TRANSFORMATION_PLAN.md` using its recommended defaults, beginning with Phase 0.

If any checkbox is not approved, record the exception before implementation so design and technical decisions remain traceable.

---

## 19. Research references

### Behavior change and personal informatics

- Harkin et al., progress monitoring and goal attainment meta-analysis: [Psychological Bulletin / PubMed](https://pubmed.ncbi.nlm.nih.gov/26479070/)
- Michie, van Stralen, and West, Behavior Change Wheel and COM-B: [Implementation Science](https://implementationscience.biomedcentral.com/articles/10.1186/1748-5908-6-42)
- Michie et al., Behavior Change Technique Taxonomy v1: [Annals of Behavioral Medicine](https://academic.oup.com/abm/article/46/1/81/4563254)
- Laranjo et al., apps/wearables and physical activity meta-analysis: [British Journal of Sports Medicine / PubMed](https://pubmed.ncbi.nlm.nih.gov/33355160/)
- Schembre et al., just-in-time feedback for diet and physical activity: [Journal of Medical Internet Research / PubMed](https://pubmed.ncbi.nlm.nih.gov/29567638/)
- Schoeppe et al., behavior-change techniques in self-report mHealth interventions: [PubMed](https://pubmed.ncbi.nlm.nih.gov/36083606/)
- Perski et al., BCTs and engagement with physical-activity/nutrition apps: [PubMed](https://pubmed.ncbi.nlm.nih.gov/37794916/)
- Teixeira et al., self-determination theory and exercise adherence: [International Journal of Behavioral Nutrition and Physical Activity / PubMed](https://pubmed.ncbi.nlm.nih.gov/22726453/)
- Ng et al., self-determination theory and health outcomes meta-analysis: [Perspectives on Psychological Science / PubMed](https://pubmed.ncbi.nlm.nih.gov/26168470/)
- Gillison et al., need-supportive behavior-change techniques meta-analysis: [PubMed](https://pubmed.ncbi.nlm.nih.gov/30295176/)
- McEwan et al., implementation intentions and physical activity: [PubMed](https://pubmed.ncbi.nlm.nih.gov/30427874/)
- Li, Dey, and Forlizzi, stage-based model of personal informatics: [Carnegie Mellon University PDF](https://www.cs.cmu.edu/~jhm/Readings/2010-ianli-chi-stage-based-model.pdf)
- Epstein et al., lived informatics and tracking lapses: [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11774256/)

### Information design and accessibility

- Cleveland and McGill, graphical perception: [Science paper PDF](https://web.cs.dal.ca/~sbrooks/csci4166-6406/seminars/readings/Cleveland_GraphicalPerception_Science85.pdf)
- W3C, Web Content Accessibility Guidelines 2.2: [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- W3C, target size minimum: [Understanding SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- W3C, reflow: [Understanding SC 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- GOV.UK, dashboard and data-visualization guidance: [Dashboards](https://brand.design-system.service.gov.uk/data/dashboards/) and [Data visualisation](https://brand.design-system.service.gov.uk/data/)
- Hullman et al., uncertainty-visualization evaluation: [University of Washington Interactive Data Lab](https://idl.uw.edu/papers/uncertainty-eval-survey)
- Health-data visualization and communication goals: [PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10797268/)

### Exercise and health-product boundaries

- American College of Sports Medicine, 2026 resistance-training guideline update: [ACSM](https://acsm.org/resistance-training-guidelines-update-2026/)
- Refalo et al., proximity to failure and muscle hypertrophy meta-regression: [Sports Medicine / PubMed](https://pubmed.ncbi.nlm.nih.gov/38970765/)
- Singer et al., inter-set rest intervals and hypertrophy: [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11349676/)
- Resistance-training volume/frequency meta-regression: [PubMed](https://pubmed.ncbi.nlm.nih.gov/41343037/)
- FDA, General Wellness: Policy for Low Risk Devices: [FDA guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices)
- FTC, Mobile Health Apps Interactive Tool: [FTC](https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool)
- FTC, best practices for mobile health app developers: [FTC](https://www.ftc.gov/business-guidance/resources/mobile-health-app-developers-ftc-best-practices)

### Engineering and testing

- React, creating a React app and framework considerations: [React documentation](https://react.dev/learn/creating-a-react-app)
- TypeScript as a static type checker and typed JavaScript superset: [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html)
- Testing Library, user-centered testing principles: [Testing Library](https://testing-library.com/docs/guiding-principles/)
- Playwright, cross-browser end-to-end testing: [Playwright documentation](https://playwright.dev/docs/intro)
- Vitest, coverage configuration: [Vitest documentation](https://vitest.dev/guide/coverage.html)
