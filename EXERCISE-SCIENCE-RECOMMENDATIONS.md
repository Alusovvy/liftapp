# Exercise science & weight-management review — Liftwise

Reviewer framing: exercise physiologist / hypertrophy and fat-loss coaching-science perspective. Scope: the currently shipped modern app (`/modern.html`) as described in `README.md` and `FUNCTIONALITY.md`, and the domain logic in `src/domain/coaching/`, `src/domain/progress/`, and `src/domain/body/`.

This is a features-and-gaps review, not a code review. Where a recommendation depends on a specific research claim, I've named the concept rather than inventing a citation — the team should source and vet its own references before adding new copy, the same way the existing "Research used" section in `README.md` does.

## 1. What the app already gets right

Worth stating plainly, because it constrains what should be added: this is one of the more scientifically honest training trackers I've reviewed. Specifically:

- **Effective-sets accounting (1.0 direct / 0.5 secondary) with a visible weekly range**, not a single magic number — `src/domain/coaching/weekly-dose.ts`. This matches how volume-landmark thinking (MEV/MAV/MRV-style ranges) is actually used by coaches: as a band, not a target.
- **RIR-first double progression with a two-appearance confirmation rule** (`README.md` §"How the next session is chosen") is a defensible, conservative implementation of autoregulated progressive overload. Most consumer apps either ignore proximity-to-failure entirely or auto-progress on a single good session.
- **Assistance-mode inversion** (less assistance = harder) is a detail most trackers get wrong.
- **Evidence-sufficiency states** (`need-data` / `emerging` / `enough-evidence`) instead of a false-precision confidence score is good statistical hygiene, and it protects users from acting on n=1 data.
- **Recovery gating that reduces or pauses recommendations** rather than scoring "readiness" is appropriately conservative — it changes behavior without pretending to diagnose fatigue.
- **A protein starting point (1.6 g/kg/day) framed as a starting point with a range**, shown only once weight is known, rather than a prescription.
- **48-hour direct-work deprioritization** in the attention engine is a reasonable proxy for local recovery without needing a soreness-per-muscle input (see §3.C for why per-muscle soreness would still be an upgrade).
- **Equipment-gated recommendations** (home-gym default, machines opt-in) means suggestions are actually actionable, which matters more for adherence than most volume-precision debates.

## 2. The biggest gap: weight loss is named in the product but not modeled

The README is explicit that "the current goal model is muscle-building oriented" and that the app "does not estimate calories." That's a defensible, honest boundary — but if weight loss is a stated goal of this review, it's the single largest capability gap. The app already has the two ingredients a real fat-loss feature needs (a body-weight trend and, via Fitatu import, logged intake) and currently does nothing with their relationship. Recommendations below extend the app's existing "transparent starting point, not a prescription" pattern — the same one already used for protein — into energy balance.

## 3. Recommendations by category

### A. Energy balance & weight-loss support (currently near-zero)

1. **Derived TDEE from trend weight + logged intake, not a formula guess.** Once ~2 weeks of both body-weight and Fitatu intake data exist, `weightKg` change over time combined with average logged calories gives a far more accurate maintenance-calorie estimate than any Mifflin-St Jeor–style formula, because it's calibrated to the individual instead of predicted from age/sex/weight. Surface it exactly like the protein card: "Based on your last 14 days, your estimated maintenance is ~X kcal/day — a starting point, not a prescription," with the underlying week-over-week weight delta and average intake shown as the "WHY."
2. **Trend weight, not raw weight, as the primary chart series.** Body weight has 1–3 kg of daily water/glycogen/GI noise; a smoothed trend line (e.g., simple 7-day moving average, shown alongside the raw points as it already does for other charts) prevents the classic "the scale went up 0.8 kg overnight" false alarm that derails adherence. `src/domain/body/body-trend.ts` already computes direction/window logic — this is a natural extension, not a new subsystem.
3. **Rate-of-change safety context.** A loss (or gain) trend outside roughly 0.5–1% of body weight per week is a well-established heuristic for "faster than typically sustainable without disproportionate muscle loss / disordered patterns." Surface this the same way the pain check-in surfaces a caution — descriptive, not alarming, with a suggestion to review food logging or talk to a professional, never a red "you're doing it wrong" flag. This is consistent with the product's existing rule to "never diagnose... nutrition deficiency" — frame it as a rate observation, not a verdict.
4. **A named diet-phase context (surplus / maintenance / deficit), user-declared.** This one flag changes what "good coaching" means elsewhere in the app: during a deficit, the evidence-based adjustment isn't to cut volume — it's to hold volume roughly constant and expect load progression to slow. Right now the coaching engine has no way to distinguish "this lifter stalled because of a genuine plateau" from "this lifter stalled because they're intentionally eating at a deficit," and the two need different messaging. Even a simple three-state profile flag would let the progression copy say "load holding steady is expected during a logged deficit" instead of implying regression.
5. **Diet-break / refeed cadence awareness for extended deficits.** If a deficit phase has been active for, say, 8+ consecutive weeks (derivable from the same phase flag above), a neutral note ("extended deficits longer than ~8-12 weeks are commonly interspersed with a maintenance break") is useful context — again framed as general information, not a push notification nagging the user to eat more.
6. **Body measurements beyond weight/body-fat**: waist, hip, and 1–2 limb circumferences. This is the single most requested feature in real fat-loss coaching because recomposition (fat down, muscle up) can show flat scale weight for weeks while the tape and mirror both show change. The data model already supports optional fields per body-metric record (`measurement condition tag`, `note`); circumferences fit the same pattern.
7. **Progress photos with a consistent-angle prompt.** Purely optional, purely local storage, deletable — the value is longitudinal self-comparison, and it's the metric least confounded by water weight.

### B. Cardio & conditioning (currently entirely absent as a first-class concept)

The app logs "duration" and "distance+duration" sets, but only as attributes of a catalog _exercise_ entry inside a _resistance_ workout structure — there's no dedicated cardio session, no heart-rate zone, and no weekly cardio target parallel to the weekly muscle-set target.

8. **A first-class cardio/conditioning session type** with intensity captured as RPE or (if available) heart-rate zone, separate from the resistance-training data model. Distance/duration sets bolted onto a "workout with entries" record work for a single Assault Bike finisher; they don't represent a 45-minute Zone 2 run well.
9. **A weekly aerobic-minutes guideline alongside the existing weekly muscle-set guideline.** The README already cites the WHO physical-activity guideline for muscle-strengthening frequency — that same guideline's aerobic-activity component (roughly 150–300 min/week moderate, or half that vigorous) is the natural sibling metric, and it's directly relevant to a weight-loss goal in a way the current app has no signal for at all.
10. **Concurrent-training sequencing note**, shown only as passive context (not a rule that blocks logging): same-day high-intensity cardio immediately before heavy lower-body work can blunt strength-session quality. A one-line "WHY"-style note, consistent with the app's existing transparency pattern, is enough — this should not become a new blocking gate.

### C. Training programming depth

11. **Deload detection, not just deload absence.** The muscle-status logic already has a "red" hard-stall state (per `README.md` §17) gated behind strict multi-session conditions. That signal is currently scoped to one muscle at a time. When a majority of tracked muscles are simultaneously flat or in a stall state, that's a different, higher-level signal than any one muscle plateauing — it's a candidate for "this looks like an accumulated-fatigue week, consider a deload," which is more actionable than five separate per-muscle stall notices.
12. **Warm-up set prescription.** The app tracks working sets precisely but has no opinion on warm-up structure. A simple percentage ramp (e.g., 50/70/85% of the last comparable top set) offered as an optional suggestion — never required, never blocking logging — would round out the progression model that already exists for working sets.
13. **Per-muscle soreness instead of one global daily figure.** The recovery check-in currently captures a single soreness value (1–5) that affects the whole day's plan. Real DOMS is muscle-specific: sore quads shouldn't automatically caution an upper-body session. This would sharpen the existing 48-hour deprioritization heuristic in `attention-engine.ts` considerably, and it's an additive field, not a redesign.
14. **Injury/pain-aware exercise substitution**, not just pain-triggered pausing. Today a pain concern pauses the _generated_ workout entirely (a reasonable, conservative default). A logical next step — still conservative — is letting a user tag a specific joint/area as currently sensitive and having the library/recommendation filter avoid movements known to load that area, the same way the equipment filter already works. This is substitution, not diagnosis: it never claims to know whether the pain is serious.
15. **Estimated 1RM / relative-strength trend as an opt-in, clearly-labeled heuristic** (e.g., Epley or Brzycki formula) for load-based exercises. This is not a claim of measured strength — it should carry the same "transparent heuristic, not a physiological measurement" framing the app already uses for effective sets — but it gives lifters a single trend line across rep ranges that today's per-rep-range comparison view doesn't surface.

### D. Recovery science depth

16. **Multi-day sleep debt, not just a same-day threshold.** The current recovery rule reacts to "sleep under 7h" on a single night. Cumulative short sleep across 3+ nights is a stronger, better-supported signal than any single night, and is a natural extension of data already being collected daily.
17. **Optional resting-heart-rate or HRV input** (manual entry now; a natural Garmin-sync target later, per the roadmap already described in `README.md` §"Garmin Connect"). Framed strictly as additional context alongside the existing subjective check-in, never as a replacement "readiness score" — the product docs are explicit that a hidden readiness score is out of scope, and this recommendation should stay consistent with that boundary.
18. **Menstrual-cycle-aware context, opt-in and descriptive only.** For a meaningful share of users, energy, strength expression, and recovery vary across the cycle in ways that are now reasonably well characterized in the literature. This should be implemented the same way everything else in this app is: an optional data point that adds context to a recommendation ("recovery inputs plus your logged cycle phase suggest keeping today's session as planned/reduced"), never a separate gated "mode," and easy to disable or ignore entirely.

## 4. Suggested priority order

If I had to pick where the science-to-effort ratio is highest:

1. Trend-weight smoothing (small change, immediately reduces false-alarm noise) — **A2**
2. Derived TDEE from existing weight + Fitatu data (no new data collection required at all) — **A1**
3. Body circumference measurements (small schema addition, high value for weight-loss users specifically) — **A6**
4. Multi-muscle deload signal (reuses existing per-muscle stall logic) — **C11**
5. A first-class cardio session type (bigger lift, but it's the single largest missing category for a weight-loss-oriented user) — **B8**

## 5. Boundaries to keep

Every recommendation above should stay inside the constraints the product has already set for itself in `README.md` §"Coaching model and limits": transparent heuristics with a visible WHY, no diagnosis, no readiness score, pain and personal judgment always override the app. The energy-balance and rate-of-loss features in particular are the easiest place to accidentally cross from "descriptive" into "prescriptive, judgmental nutrition coaching" — the existing protein-card copy pattern ("a practical starting point... not a personalized nutrition prescription") is the right template to reuse verbatim in tone.
