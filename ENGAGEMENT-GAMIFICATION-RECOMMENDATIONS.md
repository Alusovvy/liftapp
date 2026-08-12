# Engagement & gamification review — Liftwise

Reviewer framing: senior UI designer / gamification specialist. Scope: the modern app's five primary destinations (Today, Train, Progress, Body & nutrition, Library) and the Compare-with-friends feature.

## 0. Read this before the feature list

`PRODUCT_TRANSFORMATION_PLAN.md` §3.1 already contains an explicit, deliberate behavioral-design decision for this product. It names techniques **to use** (self-monitoring, feedback, autonomy-supportive language, user-set goals, opt-in prompts) and techniques **not to use**:

> Streak loss, shame, or "you failed" language. Variable rewards, loot-box patterns, or celebration frequency designed to create compulsive checking. Public rankings or social comparison. A hidden algorithmic score that tells users they are "ready" or "unready." Automatic escalation of goals after success. Notifications enabled by default.

That's not incidental — it's the correct call for a product that also implements pain-gated recovery pausing and conservative volume caps. A streak mechanic that punishes a rest day would directly fight the recovery gate that exists specifically to make rest days safe to take. So this review is organized in two tiers instead of one flat list:

- **§2 — Aligned**: extends the existing philosophy, ships without a policy debate.
- **§3 — Tension zone**: classic "addictive app" mechanics that the product has already explicitly ruled out, included here because a thorough review should name them rather than pretend they don't exist — each one is paired with the specific reason it was likely excluded and what it would take to responsibly include a defanged version, if the team ever revisits that call.

A good gamification specialist's job is to make the _behavior_ (consistent training, honest logging) rewarding — not to make the _app_ rewarding independent of the behavior. Everything in §2 optimizes for the former.

## 1. Existing engagement assets worth building on

The app already has more of the raw material for healthy engagement than it's currently getting credit for:

- **The Today page's single-recommendation hero** (`TodayPage.tsx`) is a strong "one clear next action" pattern — most habit apps bury the actionable thing under a dashboard. Keep expanding _this_, not a secondary dashboard.
- **"Weekly focus" is explicitly capped at three items** (`MAX_WEEKLY_FOCUS` in `attention-engine.ts`). This is a deliberate anti-overwhelm choice and doubles as good game design — a short, always-achievable list reads as "in reach," not "behind."
- **The weekday board** (`WeekdayBoard`) is already a lightweight, non-judgmental weekly-rhythm view — it's one UI decision away from being a genuinely satisfying "week at a glance" without needing streak framing at all.
- **Evidence badges** (`need-data` / `emerging` / `enough-evidence`) double as a natural, honest progress signal: watching a row move from "need data" to "enough evidence" is intrinsically satisfying and requires no invented points system.
- **Positive, low-pressure empty states** ("No priority review is competing for attention... Continue the current plan") are exactly the right tone — this voice should be the template for every new message this review proposes.
- **Compare-with-friends already exists** and is deliberately framed as descriptive ("not a ranking of who is training correctly"). That's the right instinct; §2.6 below suggests how to make it more _fun_ without breaking that framing.
- **`prefers-reduced-motion` is already respected** in `src/app/styles.css` — any new celebratory motion design (§2.4) has a real accessibility baseline to build on, not a retrofit.

## 2. Aligned recommendations

### 2.1 A rhythm calendar, not a streak counter

Turn the weekday board's underlying data into a GitHub-contributions-style heatmap of training days over the last several weeks. Critically: **no counter that can go to zero, no word "streak," no "broken."** A week with two sessions and a week with zero sessions are both just... shown. This gives users the visual pattern-recognition payoff of a streak grid (which is genuinely motivating) without the loss-aversion mechanic that makes classic streaks punishing on legitimate rest weeks.

### 2.2 User-set, user-owned goals with a review prompt — not auto-escalation

The plan already endorses "goal setting through routines... selected or confirmed by the user" and "review of goals when the data repeatedly conflicts with the current plan." Build the actual UI for this: a visible "your target" chip the user set themselves (sessions/week, or a muscle range), and when several weeks of data disagree with it, a single non-nagging prompt: "Your logged sessions have been below this target for 3 weeks — keep it, or adjust?" Never adjust it automatically, in either direction.

### 2.3 Opt-in, user-scheduled reminders

The plan already says prompts are fine "only when the user explicitly enables them," and that notifications must default off. That's a green light to actually build the feature, not a reason to skip it: a Settings toggle where a user picks their own days/times ("remind me at 6pm on leg day") turns an already-approved principle into a real habit-support tool. Ship the copy in the same voice as the rest of the app — informational, not guilt-based ("It's leg day" beats "You haven't trained legs in a while!").

### 2.4 Consistent, predictable positive feedback on real events — not variable rewards

The distinction that matters here: celebrating a _real, logged_ PR, a completed session, or a muscle row crossing into range is feedback on behavior (explicitly endorsed). Randomizing _when_ or _how_ that celebration appears to create anticipation is a variable-reward pattern (explicitly excluded). So: yes to a satisfying, consistent micro-animation (respecting reduced-motion) every time a set beats a prior best; no to surprise/mystery reveals, no to occasionally-withheld celebrations, no to slot-machine-style reveal animations.

### 2.5 A weekly recap as reflection, not a report card

Personal-informatics research is already cited in the plan as supporting "reflection" as a distinct, valuable stage. A Monday view of "last week: sessions logged, muscles that reached range, one PR if any" — shown only when the user opens it (not pushed) — closes the loop the plan calls for. Keep it descriptive, never graded (no letter grade, no "you did well/poorly" language, no comparison to other users).

### 2.6 Make Compare more fun without making it a leaderboard

Compare already ranks people by a chosen metric, which is already closer to a leaderboard than the rest of the app allows itself to be elsewhere — worth a second look either way (see §3.3). Within the current framing, the highest-leverage addition is a lightweight, opt-in reaction (a single "nice session" tap, no comment thread, no scoring) — this uses the same friend-group context to build social reinforcement without adding ranking pressure. Consider also letting each person choose whether their row is visible at all per metric, since right now visibility is all-or-nothing.

### 2.7 Onboarding built for an early competence win

Self-determination theory — already cited in the plan — ties continued participation to _perceived competence_, not just autonomy. The first-run experience should get a brand-new account to one real, logged set and one real "WHY" explanation as fast as possible, rather than a settings/profile wizard. Competence early beats configuration early.

### 2.8 A home-screen glance, not a push notification

Because the app is already an installable PWA, a widget/lock-screen-style glance showing just today's one recommended action (mirroring the Today hero) reduces the friction to re-open the app without needing a notification permission at all. This sidesteps the "notifications default off" constraint entirely by not being a notification — it's a passive glance the user chose to install.

## 3. Tension zone — named, not silently dropped

These are standard tools in a gamification specialist's kit that this product has already, explicitly, ruled out. Listed here so the review is honest, each with the likely reason and what a responsible version would require.

| Classic mechanic                                                           | Why it's excluded here                                                                                                                                                                                                                                             | If ever revisited                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Streak counters with loss framing** ("Day 47 — don't break it!")         | Directly undermines the recovery-gate feature, which exists to make skipping a session medically/behaviorally _correct_ sometimes. A streak mechanic punishes the exact behavior the app is designed to protect.                                                   | A streak-_count_ with zero loss language and a built-in, unlimited "rest day" allowance that never resets it — effectively §2.1's calendar with a number attached. Still requires product sign-off; the plan currently excludes this category outright. |
| **XP / levels / badges tied to volume**                                    | Risks rewarding _more sets_ precisely where the coaching engine is telling users to stop (the 3-set weekly-gap cap, the "above your configured maximum" review state). A badge system that isn't wired to the same ceiling logic would fight the app's own advice. | Badges tied strictly to _behaviors already endorsed_ — logging consistency, completing a recovery check-in, closing an evidence gap from "need data" to "enough evidence" — never to raw volume.                                                        |
| **Public leaderboards**                                                    | Explicitly excluded ("public rankings or social comparison"), and social comparison in fitness specifically correlates with disordered exercise patterns in some users. Compare already skates close to this line (§2.6).                                          | Keep ranking, if kept at all, opt-in per person per metric, framed descriptively (as it already is), never gamified with rank badges or "#1 this week" language.                                                                                        |
| **Variable/randomized rewards** ("mystery unlock," loot-box-style reveals) | Explicitly excluded; this is the mechanic most directly linked to compulsive-checking behavior in the broader app-design literature.                                                                                                                               | Not recommended in any form for this product category.                                                                                                                                                                                                  |
| **Auto-escalating goals after success**                                    | Explicitly excluded, and for a training app specifically dangerous — auto-raising volume targets after a good week is exactly how overuse injuries happen without a coach watching.                                                                                | Never automatic. §2.2's review-prompt pattern is the correct substitute.                                                                                                                                                                                |
| **Default-on push notifications**                                          | Explicitly excluded.                                                                                                                                                                                                                                               | §2.3 and §2.8 both achieve the retention goal without it.                                                                                                                                                                                               |

## 4. Suggested priority order

1. **Rhythm calendar (§2.1)** — highest visual payoff, smallest policy risk, reuses existing weekday-board data.
2. **User-set goal chip + review prompt (§2.2)** — turns an already-approved principle into a shipped feature.
3. **Opt-in scheduled reminders (§2.3)** — real retention lever the plan already cleared, just not built yet.
4. **Consistent PR/session micro-feedback (§2.4)** — small implementation, immediate delight, no policy exposure if kept non-variable.
5. **Weekly recap (§2.5)** — biggest single addition to the reflection loop the product's own research review already calls for.

## 5. One-line test for anything added later

Before shipping any new engagement feature: _would this still feel good on a week where the user did the right thing and trained less?_ If the answer is no, it's a streak-shaped mechanic wearing a different name, and it belongs in §3, not §2.
