# LiftWise workout optimization feature proposal

Status: **proposal — do not implement before explicit approval**

Prepared: 2026-08-02  
Related plan: `PRODUCT_TRANSFORMATION_PLAN.md`  
Proposed product location: **Train → Optimize plan**

> The filename intentionally follows the requested spelling: `workout-optimization-featuer.md`.

---

## 1. Executive proposal

Add a transparent **Optimize plan** section that analyzes active routines and recent completed workouts, then identifies a small number of opportunities to:

- replace an exercise with a similar training-role alternative;
- consolidate genuinely redundant exercises;
- reduce equipment changes or session complexity;
- run a controlled exercise-variation trial;
- preserve an important exercise instead of optimizing it away;
- show when two apparently similar exercises should **not** be combined.

The feature should support suggestions like:

> You used Dumbbell Curl and Concentration Curl for two sets each. They currently fill the same direct elbow-flexion role. You could use four sets of one curl variation instead and remove one setup.

It may also show a deliberately qualified time-saving option:

> You used One-Arm Dumbbell Row and Dumbbell Curl. Four row sets would keep the horizontal-pull work and reduce one setup, but they would not preserve the same direct biceps work. Keep the curl if arm development or curl strength is a priority.

It must **not** say:

> Do this one exercise for four sets and get the same effect.

Current research and LiftWise's current data cannot support that level of physiological equivalence. The product should instead compare:

- planned muscle coverage;
- movement roles;
- direct versus secondary work;
- set count and frequency;
- strength-skill specificity;
- equipment and setup;
- what is gained, preserved, and lost.

The user makes the final decision. Nothing changes automatically.

---

## 2. Product promise

> Find avoidable complexity in your current plan and preview a simpler or more varied option without hiding the trade-offs.

This is not an “optimal program generator.” The word **optimize** needs an explicit objective because no exercise is universally optimal.

Before showing opportunities, the section asks:

> What do you want to improve?

Available objectives:

1. **Save time** — fewer exercises or setup changes.
2. **Simplify my plan** — fewer redundant variations while retaining planned roles.
3. **Add purposeful variety** — one controlled alternative, not random rotation.
4. **Train with my equipment** — replace unavailable or inconvenient movements.
5. **Prioritize a muscle or skill** — preserve or increase direct, goal-relevant work.
6. **Improve comfort** — explore a user-selected alternative after discomfort, without diagnosing or treating pain.

The selected objective changes eligibility and ranking. It does not change scientific facts or hide trade-offs.

---

## 3. Current-product audit

The current application already has useful foundations:

- 61 catalog exercises;
- ten broad muscle groups;
- primary and secondary muscle mappings;
- movement-pattern labels;
- compound/isolation type;
- equipment requirements and availability filtering;
- repetition ranges and measurement conventions;
- one-to-one `swapId` and some home-equipment replacements;
- active routines and actual workout history;
- working-set qualification;
- RIR/RPE provenance;
- conservative progression and stall rules;
- favorites and custom exercises.

The current weekly-dose model counts:

```text
primary muscle set   = 1.0 weighted set
secondary muscle set = 0.5 weighted set
```

The current swap logic offers one alternative when:

- a historically used exercise is no longer available with the selected equipment; or
- three recent hard performances meet the current stall conditions.

### What the current data can support

- Detecting repeated exercises and their frequency.
- Detecting two catalog exercises with the same coarse movement pattern and primary muscles.
- Identifying equipment conflicts.
- Showing direct and secondary set-count changes.
- Comparing routine structure with what the user actually completes.
- Suggesting existing curated one-to-one alternatives conservatively.

### What the current data cannot support safely

- Claiming two exercises produce the same hypertrophy or strength result.
- Treating secondary compound work as an exact replacement for direct isolation work.
- Distinguishing all muscle regions or heads.
- Knowing technique quality, comfortable range of motion, anatomy, or injury status.
- Knowing per-exercise setup time from current session timestamps.
- Comparing kilograms across unrelated exercises as though they measure the same performance.
- Knowing whether an exercise is included for sport skill, rehabilitation, enjoyment, or a coach's instruction.
- Automatically determining the best exercise for an individual.

The feature therefore requires an enriched, reviewed exercise-role taxonomy before advanced consolidation can ship.

---

## 4. Research conclusions and design consequences

### 4.1 Purposeful variation, not constant novelty

A systematic review found that systematic exercise variation may support regional hypertrophy and exercise-specific strength, while excessive random variation and redundant exercise rotation may compromise adaptation.

Product consequence:

- suggest one controlled change at a time;
- keep a trial for enough exposures to assess usability and progression;
- do not recommend novelty simply because an exercise has been used frequently;
- distinguish “stable and productive” from “stale.”

Frequent use alone is not a reason to replace an exercise.

### 4.2 Multi-joint and single-joint work are not automatically interchangeable

The research is mixed and context dependent:

- one study in untrained participants found no additional benefit from adding arm-isolation work to bench press and lat pulldown;
- another small within-participant study found greater elbow-flexor hypertrophy from curls than one-arm rows;
- a study of bench press and triceps isolation found different changes between the pectoralis and individual triceps heads.

Product consequence:

- a compound movement may provide a time-saving alternative to direct isolation;
- the app must display the reduction in direct work;
- the card must be labeled **time-saving trade-off**, not **equivalent replacement**;
- if the isolated muscle or isolation-exercise strength is a priority, keep the isolation work.

### 4.3 Strength is exercise specific

Research comparing machine and free-weight training finds similar average hypertrophy in studied groups, but strength improvements favor the practiced test or mode. Broader work on resistance-training transfer also supports task specificity.

Product consequence:

- replacing a barbell, dumbbell, machine, bilateral, or unilateral movement can preserve a broad training role while changing exercise-specific strength practice;
- a pinned strength-skill exercise cannot be removed by simplification;
- “similar muscle coverage” must not be presented as “same strength result.”

### 4.4 Muscle name alone is insufficient

Different joint actions, exercise angles, ranges of motion, and muscle lengths can produce different adaptations and regional responses.

Product consequence:

- never merge exercises solely because both say “Back,” “Shoulders,” or another broad muscle;
- require compatible movement roles and reviewed target-region metadata;
- treat RDL plus leg curl, row plus pull-up, and overhead press plus lateral raise as distinct by default;
- do not derive equivalence from surface muscle activation rankings.

### 4.5 User autonomy is part of effectiveness

Self-determination research links autonomous motivation and competence with exercise participation.

Product consequence:

- ask what the user wants to optimize;
- offer “Keep current” as a valid, neutral choice;
- respect favorites, pinned exercises, enjoyment, and coach/clinician instructions;
- explain recommendations without using “best,” “must,” or shame;
- allow permanent suppression of an unwanted substitution.

---

## 5. Feature boundaries

### The feature is

- a plan-audit and decision-support tool;
- deterministic and explainable;
- based on active routines plus recent completed history;
- equipment and preference aware;
- reversible;
- conservative about equivalence;
- capable of saying that the existing plan should remain unchanged.

### The feature is not

- a medical or rehabilitation tool;
- an injury diagnosis;
- an exercise-ranking leaderboard;
- a generated “perfect workout”;
- an AI text guess based only on exercise names;
- a reason to change exercises that are progressing comfortably;
- an automatic routine editor;
- proof that fewer exercises always work as well;
- proof that more variety is better;
- a substitute for a qualified coach who knows the user's circumstances.

---

## 6. Opportunity types

Every suggestion belongs to one named type so users know what kind of claim is being made.

### 6.1 Redundant-role consolidation

Two exercises fill the same reviewed routine role, target the same primary region, use the same joint action/pattern, and appear in the same planning period.

Example:

```text
Current
Dumbbell Curl       2 direct sets
Concentration Curl  2 direct sets

Option
Dumbbell Curl       4 direct sets

Preserved
Biceps direct sets: 4 → 4
Elbow-flexion role: preserved

Changed
One less exercise setup
Less exercise variation
Concentration-curl skill practice removed
```

Label: **Similar planned role**

This is the strongest form of consolidation, but it still does not claim identical physiological effect.

### 6.2 One-to-one role substitution

Replace one exercise with a reviewed alternative that serves a similar broad purpose.

Examples:

- Seated Cable Row → Chest-Supported Dumbbell Row when machines are unavailable.
- Dumbbell Bench Press → Push-up when a bench or dumbbells are unavailable.
- Dumbbell Curl → Barbell Curl when reducing dumbbell adjustments is the chosen objective.

The card must show changes in loading mode, stability, equipment, and strength specificity.

Label: **Similar role with differences**

### 6.3 Compound time-saving trade-off

Reduce a direct isolation exercise because an existing compound exercise already supplies secondary work.

Example:

```text
Current
One-Arm Dumbbell Row  3 sets
Dumbbell Curl         2 direct sets

Time-saving option
One-Arm Dumbbell Row  4 sets

Coverage change
Back direct work:      3 → 4 sets
Biceps direct work:    2 → 0 sets
Biceps secondary work: 1.5 → 2 weighted sets

Trade-off
One fewer setup, but less direct biceps work.
Do not choose this if biceps size or curl strength is a priority.
```

Label: **Saves time; changes direct work**

The current `0.5` secondary-set heuristic may be shown as the app's planning model, but it must never be used to claim exact biological equivalence.

### 6.4 Purposeful variation trial

Offer one mapped alternative when:

- the user explicitly selected variety, comfort, or equipment as an objective;
- the current movement is not pinned;
- there is enough stable history to preserve a baseline;
- no pain stop or missing mapping blocks the suggestion.

The trial lasts three completed exposures or four weeks, whichever comes first. The duration is a product evaluation window, not a scientific threshold.

Label: **Controlled trial**

The app compares:

- completion;
- RIR-data quality;
- comfort and enjoyment feedback;
- setup convenience;
- within-exercise progression after a baseline exists.

It does not compare raw load between different exercises.

### 6.5 Setup simplification

Keep training roles and planned sets while reducing equipment transitions.

Example:

> Your routine changes from dumbbells to barbell and back to dumbbells. Reordering compatible exercises or choosing the reviewed dumbbell alternative would remove one equipment transition.

Reordering must respect the user's priority exercise. The feature cannot imply that order is irrelevant when the user cares about exercise-specific performance.

Label: **Simpler setup**

### 6.6 Coverage correction

Replace a redundant same-role variation with a missing, distinct role when the user's selected target and active routine justify it.

Example:

> This week contains two horizontal rows and no vertical pull. If balanced pull-pattern coverage is your objective, replace one row with Pull-up.

Label: **Changes movement coverage**

This is not consolidation and must not be described as equivalent.

### 6.7 Keep-current confirmation

The optimizer should sometimes report:

> No useful simplification found. Your repeated exercises have distinct roles or are progressing consistently.

This prevents the feature from manufacturing changes to justify its existence.

---

## 7. Definitions

### Exercise family

A group of close variants such as:

- horizontal dumbbell press;
- vertical press;
- horizontal row;
- elbow flexion;
- squat;
- single-leg squat.

Family is broader than one catalog exercise but narrower than one muscle.

### Training role

A curated combination of:

- primary target region;
- joint action or movement pattern;
- direct versus secondary contribution;
- compound/isolation function;
- laterality;
- strength-skill specificity.

### Redundant

Two planned exercises are **potentially redundant** only when:

- they have the same reviewed training role;
- they occur in the same active planning period;
- the user has not marked either as required;
- the optimization objective rewards simplification;
- consolidating them does not silently change frequency, directness, or priority.

Repeated does not automatically mean redundant.

### Similar planned coverage

The proposed routine retains the same catalog-mapped direct muscle targets and set count within the same schedule.

It does not mean identical:

- hypertrophy;
- strength;
- regional adaptation;
- fatigue;
- comfort;
- technique demand;
- injury risk.

### Required exercise

An exercise is protected when it is:

- pinned by the user;
- tied to an explicit strength/skill goal;
- marked as prescribed by a coach or clinician;
- favorited with “do not replace” enabled;
- part of an active controlled trial baseline.

---

## 8. Data windows and evidence sufficiency

### Source precedence

1. Active routine structure defines the intended plan.
2. Completed workout history confirms what is actually performed.
3. User goals and protected exercises constrain optimization.
4. Equipment and exercise taxonomy constrain possible alternatives.

### Proposed windows

- Active routines: current version.
- Recent-use analysis: last 42 days.
- Stable baseline: at least three completed appearances on separate dates.
- “Used often” wording: at least four appearances across at least three dates in the 42-day window.
- Controlled trial review: three completed exposures or four weeks.

These are transparent product heuristics and must be configurable in code. They are not physiological cutoffs.

### Evidence labels

| Label | Requirement | Allowed output |
| --- | --- | --- |
| **Routine only** | Planned exercises exist, but recent completion is insufficient | Structural observation; no personal-effect claim |
| **Usage confirmed** | Recent history confirms the planned pair and enough qualified sets | Consolidation preview with exact logged/planned inputs |
| **Trial ready** | Stable baseline plus a reviewed alternative and no exclusion | Controlled one-to-one trial |
| **Needs mapping** | Custom/imported exercise lacks required role metadata | Ask for mapping; do not optimize |

Do not display a numerical confidence score.

---

## 9. Eligibility gates

The engine first applies hard gates. Ranking happens only after a candidate passes them.

### Global gates

No optimization suggestion when:

- the current recovery check contains a pain stop relevant to training;
- stored/imported data needed by the opportunity is invalid;
- the routine is being edited elsewhere or has an unresolved import;
- fewer than two relevant planned exercises exist;
- the user disabled optimization.

### Exercise-level gates

Do not remove or consolidate an exercise when:

- it is protected;
- it has an explicit sport/strength-skill goal;
- it is coach/clinician prescribed;
- its custom-exercise mapping is incomplete;
- it uses a distinct joint action or reviewed target region;
- it is the only exercise in an important configured movement role;
- the alternative is unavailable with current equipment;
- the user previously selected “Never suggest this swap”;
- measurement or unilateral conventions are unresolved;
- a variation trial is already active for it.

### Pair-consolidation gates

Two-to-one consolidation requires all of the following:

1. Same reviewed training-role ID.
2. Same direct primary target regions.
3. Compatible movement pattern and joint action.
4. Same planned session, or the proposal preserves the original weekly frequency.
5. Total proposed direct sets can be preserved without exceeding the conservative automatic set guardrail.
6. Neither exercise is protected.
7. No meaningful role-specific difference is hidden.
8. User objective is Save time or Simplify my plan.

The initial conservative automatic guardrail should be **no more than four proposed working sets for one exercise in one session**. This is a product safety limit for automatic suggestions, not a universal optimal-set prescription. If preservation requires more, show the overlap but do not generate a one-click consolidation.

### Compound-consolidation gates

A compound-plus-isolation pair can never receive the **Similar planned role** label solely from shared muscles. It can only receive a **Saves time; changes direct work** option with:

- direct and secondary coverage shown separately;
- explicit lost direct work;
- a goal-based warning;
- no “same effect” language.

An advanced compound exercise that directly covers two prior roles may be proposed only through a manually reviewed `consolidatesRoles` relationship. Muscle-name overlap is not enough.

---

## 10. Set and frequency logic

### Set sources

- For an active routine, use planned normal working sets.
- For usage confirmation, count qualified non-warm-up working sets.
- Show planned and completed medians separately when they differ.
- Do not count warm-up sets.
- Do not silently convert duration, distance, drop sets, or unresolved imported sets.

### Redundant-role set transfer

For two same-role exercises in the same session:

```text
proposed sets = source exercise A sets + source exercise B sets
```

Only generate the proposal when the result is at most four sets. Otherwise:

- explain that the role overlaps;
- offer “Choose one variation per session” or a manual routine review;
- do not claim that four sets replace six.

The existing three-set cap for automatically adding work toward a weekly gap remains unchanged. Four-set consolidation only rearranges up to four already planned same-role sets; it does not create new weekly volume.

### Cross-session handling

If the two source exercises occur on different days:

- preserve the two-day frequency;
- optionally use the same chosen variation on both days;
- do not move all sets into one day automatically;
- show that simplification reduces variation, not weekly exercise count.

### Compound time-saving option

Never add secondary weighted sets until they numerically “equal” removed direct sets.

Instead:

1. Show the source direct sets.
2. Show existing and proposed secondary weighted sets.
3. Show the exact proposed set change.
4. State that direct work decreases.
5. Require explicit confirmation that time saving outranks the isolated target.

### Target-range interaction

Every preview recomputes the current weekly planning model:

- primary = `1.0` weighted set;
- secondary = `0.5` weighted set.

If the proposal moves a configured muscle below its minimum or above its maximum:

- show the change;
- prevent “similar coverage” labeling;
- do not auto-apply;
- allow a manual edit only after clear confirmation.

The weekly ranges remain user-configured planning ranges, not universal prescriptions.

---

## 11. Deterministic opportunity ordering

Do not create an opaque “optimization score.” Use eligibility gates followed by an ordered decision ladder:

1. Equipment conflict with a reviewed available replacement.
2. Exact same-role redundancy that preserves direct sets and frequency.
3. Setup simplification that preserves all protected roles.
4. User-requested time-saving trade-off.
5. User-requested coverage correction.
6. User-requested controlled variation trial.
7. Existing conservative stall-swap opportunity.
8. Keep-current confirmation.

Within one level, order by:

- match with the selected objective;
- stronger exercise-role mapping;
- confirmation in completed history;
- fewer changed exercises;
- fewer lost direct sets;
- less disruption to protected/favorite movements;
- most recently active routine.

Show no more than **three opportunities** at once.

---

## 12. Exercise taxonomy required

The existing catalog should be extended with reviewed metadata.

### Required fields

```ts
type ExerciseOptimizationMetadata = {
  exerciseId: string;
  metadataVersion: number;

  familyId: string;
  trainingRoleIds: string[];
  primaryRegions: string[];
  secondaryRegions: string[];
  jointActions: string[];
  movementPlane?: "sagittal" | "frontal" | "transverse" | "mixed";
  laterality: "bilateral" | "unilateral" | "either";
  kineticContext?: "open" | "closed" | "mixed";

  directnessByRegion: Record<string, "direct" | "secondary">;
  strengthSkillIds: string[];
  setupGroupIds: string[];
  stabilityDemand: "low" | "medium" | "high";
  systemicFatigueEstimate: "low" | "medium" | "high";
  lowerBackDemand?: "low" | "medium" | "high";
  gripDemand?: "low" | "medium" | "high";

  mappingStatus: "reviewed" | "partial" | "unmapped";
  reviewedAt?: string;
  sourceNotes?: string[];
};
```

Fatigue and demand fields are coarse planning descriptors, not personalized physiological measurements.

### Curated relationship graph

```ts
type ExerciseRelationship = {
  fromExerciseIds: string[];
  toExerciseId: string;
  kind:
    | "same_role"
    | "similar_role"
    | "equipment_alternative"
    | "time_saving_tradeoff"
    | "coverage_change"
    | "consolidates_roles";

  allowedObjectives: OptimizationObjective[];
  preservedRoleIds: string[];
  lostRoleIds: string[];
  gainedRoleIds: string[];
  caveats: string[];
  evidenceTier: "catalog_reviewed" | "limited_research" | "user_defined";
  enabled: boolean;
  reviewedAt: string;
};
```

Relationships are directional. Replacing A with B does not imply that replacing B with A has the same trade-offs.

### Custom exercises

Custom exercises need an optional advanced mapping flow:

- family;
- movement pattern;
- direct targets;
- secondary targets;
- equipment;
- laterality;
- “Do not replace”;
- optional user-selected similar catalog exercise.

Until required fields are reviewed or confirmed, custom exercises may appear in usage summaries but are excluded from automatic consolidation.

---

## 13. User preference and revision data

Proposed persisted additions:

```ts
type OptimizationPreferences = {
  enabled: boolean;
  objective: OptimizationObjective;
  maxVisibleOpportunities: 3;
  protectedExerciseIds: string[];
  suppressedRelationshipIds: string[];
  snoozedOpportunityIds: Record<string, string>;
};

type OptimizationOpportunity = {
  id: string;
  generatedAt: string;
  sourceRoutineId: string;
  sourceRoutineRevision: number;
  objective: OptimizationObjective;
  kind: ExerciseRelationship["kind"];
  sourceExerciseIds: string[];
  proposedExerciseIds: string[];
  beforeSnapshot: RoutineSnapshot;
  afterPreview: RoutineSnapshot;
  preserved: string[];
  changed: string[];
  evidenceState: "routine_only" | "usage_confirmed" | "trial_ready";
  ruleIds: string[];
};

type OptimizationTrial = {
  id: string;
  opportunityId: string;
  originalRoutineSnapshot: RoutineSnapshot;
  trialRoutineRevisionId: string;
  startedAt: string;
  targetExposures: 3;
  completedExposureWorkoutIds: string[];
  status: "active" | "keep" | "reverted" | "cancelled";
  feedback?: {
    comfort?: number;
    enjoyment?: number;
    setupConvenience?: number;
    note?: string;
  };
};
```

Every applied change creates a routine revision and retains an immediate undo path.

---

## 14. UX specification

### 14.1 Entry points

Primary:

- **Train → Optimize plan**

Secondary:

- “Review optimization” on a routine card;
- “Explore alternatives” on exercise detail;
- “Review this routine” after enough relevant history exists.

Do not place persistent optimization warnings on Today. A high-quality opportunity may appear as a quiet optional link, never above safety, recovery, or today's training action.

### 14.2 Page hierarchy

```text
Optimize plan
Find avoidable complexity without hiding the trade-offs.

What do you want to improve?
[Save time] [Simplify] [Add variety] [Equipment] [Prioritize] [Comfort]

Based on:
Upper / Lower routine · last 42 days · 8 completed workouts

2 useful opportunities

┌─────────────────────────────────────────────────────────────┐
│ SIMILAR PLANNED ROLE                                        │
│ Use one curl variation instead of two                       │
│                                                             │
│ CURRENT                      OPTION                          │
│ DB Curl          2 sets     DB Curl          4 sets         │
│ Concentration    2 sets                                     │
│                                                             │
│ Preserved: 4 direct biceps sets · elbow-flexion role        │
│ Changed: less variation · one setup removed                 │
│                                                             │
│ [Preview routine] [Try for 3 sessions] [Keep current]       │
│ Why this appeared ▾                                         │
└─────────────────────────────────────────────────────────────┘

No change needed
Your row and pull-up look similar by muscle, but preserve
different horizontal and vertical pulling roles.
```

### 14.3 Card contract

Each card contains:

1. Opportunity type.
2. Plain-language proposed action.
3. Current and proposed structure.
4. Preserved items.
5. Changed or lost items.
6. Evidence label.
7. Primary preview action.
8. Keep-current option.
9. “Why this appeared” details.

No before/after comparison may rely on color alone.

### 14.4 Why drawer

Show:

- active routine and revision analyzed;
- date window;
- relevant completed workouts;
- source planned and completed sets;
- training-role mappings;
- equipment constraints;
- protected-exercise checks;
- exact rule IDs;
- direct/secondary calculation;
- reasons a seemingly similar exercise was excluded.

### 14.5 Preview flow

```text
Opportunity card
      ↓
Routine diff preview
      ↓
Coverage + schedule + equipment comparison
      ↓
Choose:
  Try temporarily / Apply / Keep current
      ↓
Confirm routine revision
      ↓
Undo available
```

The preview is mandatory. A card cannot mutate a routine directly.

### 14.6 User controls

- Keep current.
- Try for three exposures.
- Apply to routine.
- Edit the proposal before applying.
- Snooze for six weeks.
- Never suggest this replacement.
- Protect this exercise.
- Undo.

“Keep current” closes the opportunity without negative messaging.

---

## 15. Example decisions using the current catalog

These examples illustrate the proposed rules. They are not pre-approved exercise prescriptions.

### Strong same-role candidates after metadata review

| Pair | Possible action | Important caveat |
| --- | --- | --- |
| Dumbbell Curl + Concentration Curl | Consolidate direct sets into one curl | Loses supported single-arm variation/skill |
| Dumbbell Curl + Barbell Curl | Choose one when simplification is the goal | Changes bilateral implement and exercise-specific strength |
| Goblet Squat + Dumbbell Squat | Choose one same-session squat variation | Loading position and comfort may differ |
| Overhead Press + Dumbbell Shoulder Press | Choose one vertical press | Barbell/dumbbell and bilateral freedom affect skill/stability |
| One-Arm DB Row + Chest-Supported DB Row | Possible one-role simplification | Changes lower-back/stability and unilateral practice |

### Possible but trade-off-heavy

| Pair | Possible action | Must disclose |
| --- | --- | --- |
| Row + curl | More row work, remove curl | Direct biceps work decreases |
| Bench press + triceps isolation | Keep bench only for time | Direct elbow-extension work and triceps-head emphasis may change |
| Dumbbell bench + push-up | Use one horizontal push | Loading mode and strength skill change |
| Hip thrust + glute bridge | Choose one hip-extension role | Loadability, range, and setup differ |
| Cable lateral raise + dumbbell lateral raise | Choose available variation | Resistance profile and equipment change |

### Do not consolidate by default

| Pair | Reason |
| --- | --- |
| Row + pull-up | Horizontal and vertical pull roles differ |
| RDL + seated leg curl | Hip extension/hinge and knee flexion differ |
| Squat + RDL | Knee-dominant squat and hip hinge differ |
| Overhead press + lateral raise | Compound vertical press and shoulder isolation differ |
| Bench press + chest fly | Compound press and chest isolation differ |
| Flat press + incline press | Angle and regional emphasis may differ |
| Pallof press + crunch | Anti-rotation and trunk flexion differ |
| Plank + Russian twist | Anti-extension and rotation differ |
| Bilateral + unilateral movement | Keep both when unilateral skill/asymmetry is an explicit goal |

Showing “do not combine” decisions is a core trust feature, not an edge case.

---

## 16. Feedback and trial behavior

### Before a trial

Record:

- original routine revision;
- original exercise history baseline;
- reason for the change;
- selected optimization objective;
- expected preserved and changed roles.

### During a trial

- Mark the exercise as “Trial 1 of 3,” not “new optimum.”
- Keep original and trial exercise histories separate.
- Do not compare kilograms or repetitions across different movement IDs.
- Continue normal within-exercise progression only after the trial movement has its own baseline.
- Let the user revert immediately.

### Trial review

After three exposures or four weeks, ask:

- Was this movement comfortable?
- Was setup more convenient?
- Did you enjoy it enough to repeat?
- Do you want to keep it, restore the original, or continue the trial?

Show performance only within each exercise's own measurement conventions.

The app must not interpret “feeling the muscle,” soreness, or one strong session as proof of superior adaptation.

---

## 17. Safety and language guardrails

### Pain and discomfort

- Pain stops the optimization proposal and routes to the existing pain response.
- “Improve comfort” means exploring a user-selected alternative after the user is ready; it is not treatment.
- Do not recommend around a reported injury.
- Do not state that an alternative is safer for an individual.

### Required wording

Use:

- similar planned role;
- preserves mapped direct sets;
- changes direct work;
- may reduce setup;
- controlled trial;
- based on your selected objective;
- keep the current exercise if it is comfortable and progressing.

Avoid:

- same effect;
- better gains;
- optimal exercise;
- fixes imbalance;
- injury-proof;
- useless exercise;
- junk volume;
- must replace;
- scientifically proven for you.

### Visual semantics

- Neutral blue/gray: opportunity.
- Amber: meaningful trade-off or incomplete mapping.
- Red: invalid data, pain stop, or safety issue only.
- Green: user-approved/applied state, not physiological superiority.

---

## 18. Engineering architecture

Build the feature on the proposed React + TypeScript architecture from the main transformation plan.

### Domain modules

```text
src/domain/optimization/
  analyze-plan.ts
  build-opportunities.ts
  eligibility.ts
  evidence.ts
  relationship-graph.ts
  routine-diff.ts
  set-transfer.ts
  trial-review.ts
  types.ts
```

### Feature modules

```text
src/features/train/optimize/
  OptimizePlanPage.tsx
  ObjectiveSelector.tsx
  OpportunityCard.tsx
  RoutineDiffPreview.tsx
  CoverageComparison.tsx
  WhyOptimizationDrawer.tsx
  TrialStatus.tsx
```

### Dependency rule

```text
UI
 ↓
optimization view model
 ↓
pure opportunity rules
 ↓
exercise taxonomy + routine/workout selectors
 ↓
typed repository
```

Optimization rules must not:

- read DOM state;
- write local storage;
- mutate routines;
- generate prose as the source of truth.

They return structured facts and rule IDs. The UI renders reviewed content templates from those facts.

### Routine revision behavior

Applying a proposal:

1. Verifies that the source routine revision still matches.
2. Creates a new immutable revision snapshot.
3. Applies the reviewed diff.
4. Preserves the previous active revision.
5. Records the originating opportunity.
6. Shows undo.

If the routine changed after analysis, invalidate the preview and rerun it.

---

## 19. Testing strategy

### 19.1 Taxonomy validation

Tests must ensure:

- every relationship references existing exercises and roles;
- relationship direction is explicit;
- every relationship has at least one caveat or an explicit “none identified” review;
- primary/secondary targets do not overlap incorrectly;
- disabled or unmapped relationships never generate opportunities;
- metadata versions are included in opportunity provenance;
- every built-in exercise has a declared mapping status.

### 19.2 Rule-unit tests

Table-driven coverage for:

- exact same-role pair passes;
- same muscle but different pattern fails;
- different target region fails;
- protected exercise fails;
- unavailable candidate fails;
- pain state blocks all proposals;
- incomplete custom mapping fails;
- same-session 2 + 2 sets proposes 4;
- same-session 3 + 3 sets does not auto-propose 4 as equivalent;
- cross-session frequency is preserved;
- warm-ups are excluded;
- direct and secondary work stay separate;
- compound trade-off can never receive the similar-role label;
- selected objective changes ranking, not eligibility facts;
- no more than three opportunities are returned;
- results are deterministic for the same inputs;
- suppressed and snoozed relationships remain hidden;
- stale routine revisions invalidate previews.

### 19.3 Property/invariant tests

For any generated opportunity:

- before and after snapshots are immutable;
- no unavailable exercise is introduced;
- no protected exercise is removed;
- no lost direct role is omitted from the comparison;
- “similar planned coverage” preserves direct set count and weekly frequency;
- no proposed same-session exercise exceeds four automatically generated sets;
- no opportunity contains “same effect,” “optimal,” or equivalent prohibited copy;
- applying and undoing restores an identical routine snapshot;
- data outside the target routine is unchanged.

### 19.4 Component tests

- Objective selector changes visible ordering.
- Opportunity card exposes preserved and changed information.
- Keyboard and screen-reader users can compare before/after states.
- Keep current, snooze, suppress, protect, and preview work.
- Routine diff requires confirmation.
- Stale preview shows a recoverable message.
- Trial review never defaults to Keep or Revert.
- Pain state removes apply/trial actions.

### 19.5 End-to-end journeys

1. Choose Simplify → review a 2 + 2 same-role consolidation → apply → undo.
2. Choose Save time → inspect a compound trade-off → keep direct isolation.
3. Protect an exercise → rerun analysis → it is not removed.
4. Start a three-exposure variation trial → log sessions → choose Keep.
5. Start a trial → revert after one session → original routine returns.
6. Analyze a custom unmapped exercise → complete mapping → receive eligible preview.
7. Modify the routine in another view → stale optimization preview is blocked.
8. Report pain → optimizer cannot generate or apply a training change.
9. Restore a backup containing routine revisions/trials → state remains consistent.
10. Use the complete flow at 320 px and by keyboard.

### 19.6 Accessibility checks

- WCAG 2.2 AA.
- Before/after information remains understandable without color.
- Tables reflow or have a linear mobile representation.
- Diff changes have text labels such as Added, Removed, Preserved.
- Focus moves to the preview heading and returns correctly.
- Status updates are announced without interrupting active input.
- No drag-only routine editing.
- Reduced motion supported.

---

## 20. Validation and success criteria

### Usability tasks

Ask participants to:

1. Explain why two curl variations were considered redundant.
2. Explain why a row and pull-up were not combined.
3. Identify what is lost when a curl is replaced by more row work.
4. protect a preferred exercise;
5. preview and undo a routine change;
6. decide whether to keep a trial movement.

### Target outcomes

- At least 85% correctly distinguish similar planned coverage from same physiological effect.
- At least 85% identify the lost direct work on a compound time-saving card.
- At least 90% find Keep current without assistance.
- At least 90% successfully preview and undo a routine change.
- No generated opportunity removes a protected exercise.
- No generated opportunity violates equipment constraints.
- No generated opportunity labels a direct-to-secondary trade as equivalent.
- No saved routine change occurs without preview and confirmation.
- All critical flows pass keyboard, 320 px, and automated accessibility checks.

Do not optimize the feature for:

- number of accepted suggestions;
- frequent exercise switching;
- dismissal avoidance;
- time spent reviewing cards;
- a higher “optimization score.”

A high keep-current rate can be a good outcome when the existing plan fits the user's goals.

---

## 21. Delivery phases

### Phase 0 — catalog and rule specification

Deliver:

- reviewed exercise-role vocabulary;
- mapping-status rules;
- prohibited claims and content templates;
- current-catalog mapping audit;
- fixtures for representative routines;
- professional review of high-impact relationships.

Gate:

- no optimizer UI;
- no relationship ships solely from broad muscle overlap;
- uncertain mappings remain disabled.

### Phase 1 — read-only redundancy audit

Deliver:

- pure analysis engine;
- same-role redundancy;
- do-not-combine explanations;
- equipment conflicts;
- read-only Optimize plan section;
- no apply button.

Gate:

- all invariants pass;
- users understand preserved versus changed roles;
- false-equivalence copy review passes.

### Phase 2 — preview and routine revisions

Deliver:

- objective selector;
- routine diff;
- coverage/frequency comparison;
- apply, protect, snooze, suppress, and undo;
- immutable routine revisions.

Gate:

- stale revisions are blocked;
- apply/undo round trip is exact;
- no silent data or target changes.

### Phase 3 — controlled variation trials

Deliver:

- three-exposure trial state;
- baseline preservation;
- within-exercise progress handling;
- feedback and keep/revert review.

Gate:

- different exercises are never compared by raw load;
- trial completion never auto-selects an outcome;
- original routine always remains recoverable.

### Phase 4 — compound time-saving trade-offs

Deliver:

- direct/secondary split comparison;
- limited reviewed compound relationships;
- goal-based warnings;
- opt-in time-saving proposals.

Gate:

- no compound proposal is labeled equivalent;
- lost direct work is visible before the primary action;
- professional content/domain review approves every enabled relationship.

### Phase 5 — evaluation and expansion

Deliver:

- usability findings;
- reviewed additional relationships;
- custom-exercise advanced mapping;
- updated documentation and backup schema.

Gate:

- success criteria are met;
- new relationships use the same review process;
- there is no automatic, generative expansion of the relationship graph.

---

## 22. Risks and controls

| Risk | Control |
| --- | --- |
| “Optimization” implies one universal best program | Require a user-selected objective and show Keep current |
| Two exercises are treated as physiologically identical | Use similar planned role; prohibit same-effect copy |
| Compound secondary work replaces direct work silently | Separate direct/secondary values and label the loss |
| Strength skill is lost | Protected exercises and explicit specificity warning |
| Random variation disrupts progression | One controlled trial at a time with preserved baseline |
| App makes a medical recommendation | Pain stop and non-medical comfort language |
| Coarse muscle tags create bad suggestions | Reviewed role/region taxonomy and hard eligibility gates |
| Custom/imported exercises are guessed | Needs-mapping state; exclude from auto-consolidation |
| Set compression creates excessive single-exercise work | Four-set automatic guardrail and frequency preservation |
| Routine changes become destructive | Preview, immutable revision, and undo |
| Feature creates changes to drive engagement | Keep-current result and no acceptance-rate optimization |
| Relationship catalog becomes unmaintainable | Versioned directed graph, validation tests, review metadata |

---

## 23. Explicit non-goals

This proposal does not include:

- claims of equal hypertrophy, strength, or safety;
- automatically replacing two exercises with one from muscle overlap alone;
- EMG-based exercise rankings;
- injury-specific substitutions;
- rehabilitation prescriptions;
- calorie or recovery optimization;
- an LLM generating uncatalogued substitutions;
- automatic routine mutation;
- daily pressure to accept an optimization;
- exercise tier lists;
- social comparison;
- a single program-quality score.

---

## 24. Approval checklist

Approval of this feature proposal means approval of these defaults:

- [ ] Location: Train → Optimize plan
- [ ] User selects the optimization objective
- [ ] Maximum three opportunities
- [ ] “Similar planned role,” never “same effect”
- [ ] Direct and secondary work remain separate
- [ ] Four-set guardrail for automatic same-session consolidation
- [ ] Exercise frequency is preserved
- [ ] Protected/favorite/coach-prescribed exercises are respected
- [ ] Controlled variation uses a reversible three-exposure trial
- [ ] Every mutation requires preview and confirmation
- [ ] Routine revisions and undo are mandatory
- [ ] Advanced compound trade-offs ship only after the simpler read-only engine
- [ ] Exercise relationships are curated and versioned, not generated from names
- [ ] WCAG 2.2 AA and the full test strategy apply

Suggested approval wording:

> Approved. Add `workout-optimization-featuer.md` to the transformation scope and implement it in the specified phases, beginning with Phase 0.

Exceptions should be written into this file before implementation.

---

## 25. Research references

### Exercise selection and variation

- Kassiano et al., systematic versus excessive/random exercise variation: [Does Varying Resistance Exercises Promote Superior Muscle Hypertrophy and Strength Gains?](https://pubmed.ncbi.nlm.nih.gov/35438660/)
- Gentil et al., adding single-joint exercises to an upper-body multi-joint program: [PubMed](https://pubmed.ncbi.nlm.nih.gov/23537028/)
- Mannarino et al., unilateral row versus biceps curl and elbow-flexor hypertrophy: [PubMed](https://pubmed.ncbi.nlm.nih.gov/31268995/)
- Brandão et al., multi-joint/single-joint combinations and different regional adaptations: [PubMed](https://pubmed.ncbi.nlm.nih.gov/32149887/)
- Gentil et al., single-joint versus multi-joint elbow-flexor training: [PubMed](https://pubmed.ncbi.nlm.nih.gov/26446291/)

### Specificity, modality, and range

- Haugen et al., free-weight versus machine training meta-analysis: [PubMed](https://pubmed.ncbi.nlm.nih.gov/37582807/)
- Heidel et al., machines versus free weights and strength specificity: [PubMed](https://pubmed.ncbi.nlm.nih.gov/34609100/)
- Saeterbakken et al., resistance-training task specificity and transfer: [PubMed](https://pubmed.ncbi.nlm.nih.gov/40314751/)
- Pallarés et al., range-of-motion adaptations meta-analysis: [PubMed](https://pubmed.ncbi.nlm.nih.gov/34170576/)
- Kassiano et al., range of motion and regional hypertrophy review: [PubMed](https://pubmed.ncbi.nlm.nih.gov/36662126/)

### Training guidance and behavior

- American College of Sports Medicine, 2026 resistance-training guideline update: [ACSM](https://acsm.org/resistance-training-guidelines-update-2026/)
- Teixeira et al., self-determination theory and exercise behavior: [PubMed](https://pubmed.ncbi.nlm.nih.gov/22726453/)
- Rhodes et al., factors associated with resistance-training participation: [PubMed](https://pubmed.ncbi.nlm.nih.gov/28404558/)
- W3C, Web Content Accessibility Guidelines 2.2: [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
