# Personal Productivity App — Spec v4 (final, self-contained)

A single-user (eventually friend-sharable) PWA combining time tracking, task management, habit tracking, daily review, and ADHD-aware gamification. Built to live on free tiers indefinitely. This document is complete on its own; no prior spec versions required.

---

## 1. Design philosophy

Built by and for someone with ADHD. Three principles shape every decision:

1. **Soft failure modes, not punishments.** Strict streak resets cause abandonment (well-documented in HCI research on Streaks, Habitica, Duolingo). Freezes are mandatory. Rolling averages shown alongside daily scores. One bad day must not erase a week.
2. **Visible progress, immediate feedback.** Credits, scores, stats update live. The End Day ritual creates a clean feedback loop: work → log → see score.
3. **Self-knowledge over self-discipline.** The app's primary value is showing where time actually goes — estimate vs actual, time-per-task, quality distribution. Data beats nags.

A productivity app does not fix ADHD. It supports an already-functional system. If you find yourself adding features instead of using the app, that's the symptom, not the solution.

---

## 2. Goals

- Track time with categories, quality ratings, free-form tags.
- Manage tasks with required estimates, deadlines, Eisenhower prioritization.
- Track habits with mandatory streak freezes.
- Daily ritual: End Day click → PM review → next morning AM rundown.
- Silent countdown timer (Pomodoro variant).
- Quality-weighted credits with variable rewards.
- Soft red-day signals always shown with rolling context.
- Productivity score compared to personal rolling average.
- Overwork converts to credits AND optionally banked freeze days.
- ADHD-targeted features phased in as data accumulates to power them.

## 3. Non-goals (v1)

- Multi-user team features, billing.
- Google Calendar **write-back** and conflict resolution — v1.0+; **read-only, multi-account context** shipped in v0.2 (see §6.17 and §9 v0.2 implementation status).
- iOS push notifications (Apple's PWA push is unreliable; in-app banners only).
- Native iOS/Android apps.
- Idle auto-stop on tracked time.
- Focus mode / app blocker.
- Monetization.

---

## 4. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14+ App Router, React, TypeScript | PWA |
| UI | Tailwind + shadcn/ui | Mobile-first |
| Backend | Next.js server actions + API routes | No separate service |
| Database | Turso (libSQL) | Free tier, no pause-on-inactivity |
| ORM | Drizzle | Type-safe, libSQL-native |
| Auth | Auth.js + Resend magic link | 3K emails/mo free; no passwords |
| Hosting | Vercel Hobby tier | Free; non-commercial use only |
| State (client) | Zustand | Running timer, modals, ephemeral UI |
| State (server) | TanStack Query | Cached fetches, optimistic updates |
| Charts | Recharts | Analysis views |
| Date | date-fns + date-fns-tz | TZ-correct |
| Drag-drop | dnd-kit | Eisenhower matrix |
| Email | Resend free tier | Magic link only |
| CI | GitHub Actions | Typecheck, lint, build on PRs |

See `tech_setup.md` for accounts, env vars, and deployment.

---

## 5. Data model

### 5.1 Identity

**`users`**
- `id` (uuid), `email` (unique), `name`, `timezone` (IANA, default America/Los_Angeles)
- `created_at`
- `settings_json` — flexible blob: red_day_threshold, score weights, freeze settings, overwork split, theme, sound prefs

### 5.2 Time tracking

**`categories`**
- `id`, `user_id`, `name`, `base_credit_rate` (min/hr), `color`, `is_free_time` (bool), `archived` (bool)

Seeded on signup:

| Name | Rate (min/hr) | is_free_time |
|---|---|---|
| Deep work | 15 | false |
| Regular work | 10 | false |
| Admin / shallow | 5 | false |
| Learning | 12 | false |
| Exercise | 8 | false |
| Sleep | 0 | false |
| Free time (earned) | 0 | true |

**`tags`**
- `id`, `user_id`, `name`

**`projects`** *(added for ADHD staleness tracking)*
- `id`, `user_id`, `name`, `description`, `status` ('active' | 'paused' | 'retired')
- `retired_reason` (text, nullable — required when status flips to retired)
- `retired_at`, `created_at`, `updated_at`

**`time_blocks`**
- `id`, `user_id`, `category_id`
- `start_at`, `end_at` (nullable while running)
- `label`, `quality` (useful | chores | meh | wasted | null)
- `notes`, `manual_entry` (bool)
- `task_id` (nullable fk), `habit_completion_id` (nullable fk), `project_id` (nullable fk)
- `random_bonus_applied` (bool, default false)
- `stated_intent` (text, nullable — for body doubling proxy)
- `created_at`, `updated_at`

**Constraint:** unique partial index on `(user_id)` where `end_at IS NULL` — only one running block per user.

**`time_block_tags`** (many-to-many)
- `time_block_id`, `tag_id`

### 5.3 Schedule & day status

**`schedule_goals`**
- `id`, `user_id`, `category_id`, `target_minutes_per_day`
- `effective_from`, `effective_to` (nullable for versioning)

**`day_status`** (cached, recomputed on End Day or relevant edits)
- `user_id`, `date`
- `goal_hit_percent`, `is_red` (bool)
- `credits_earned`, `credits_spent`, `credits_overwork_bonus`
- `is_off_day`, `is_vacation`
- `habits_completion_percent`
- `productivity_score` (0–100)
- `score_vs_avg_delta` (real, +/-)
- `ended_at` (nullable — set on End Day click)

**`off_day_balance`**
- `user_id` (pk)
- `available` (int — capped at 5, see §6.6)
- `lifetime_forfeited` (int — accruals lost to cap, for honest reporting)
- `last_recalc_date`

**`off_day_uses`**
- `id`, `user_id`, `date`, `reason` (text, optional)

**`vacations`**
- `id`, `user_id`, `start_date`, `end_date`, `reason`

### 5.4 Tasks

**`tasks`**
- `id`, `user_id`
- `title`, `description`
- `category_id` (nullable)
- `project_id` (nullable fk)
- `estimate_minutes` (int, required)
- `actual_minutes` (int, auto-computed from linked time blocks)
- `due_date`, `scheduled_date` (date, nullable)
- `status` ('backlog' | 'scheduled' | 'in_progress' | 'completed' | 'dropped')
- `completed_at`, `dropped_at`, `drop_reason` (text, nullable)
- `urgency` (int 1–4), `importance` (int 1–4)
- `reschedule_count` (int, default 0)
- `sort_order` (int — within-quadrant ordering)
- `created_at`, `updated_at`

**Eisenhower mapping:** urgency ≤ 2 = urgent, importance ≤ 2 = important. Quadrant computed on read.

### 5.5 Habits

**`habits`**
- `id`, `user_id`, `name`, `description`
- `target_per_day` (int, default 1)
- `category_id` (nullable)
- `active` (bool), `archived_at`
- `created_at`

**`habit_completions`**
- `id`, `user_id`, `habit_id`
- `completed_at`, `count` (int, default 1)
- `notes`, `linked_time_block_id`

**`habit_streaks`** (cached)
- `id`, `habit_id`
- `current_streak`, `longest_streak`
- `days_hit_last_30` (int — frequency-over-consecutive metric)
- `last_completed_date`
- `freezes_available` (int)
- `freezes_used_this_month` (int)

**Freeze rules:**
- Monthly grant: 2 freezes auto-granted on the 1st (per habit).
- Overwork conversion: 8 hours of overwork = 1 freeze (any habit, user chooses).
- Auto-apply: if a habit is missed by midnight and `freezes_available > 0`, automatically consume one. Streak survives. Shown as ❄ in history.
- Cap: max 5 freezes per habit at any time.

### 5.6 Reminders

**`reminders`**
- `id`, `user_id`, `title`
- `remind_at` (timestamp with TZ)
- `recurring` (null | 'daily' | 'weekly' | 'monthly')
- `recurring_day_of_week` (int, nullable)
- `linked_task_id` (nullable)
- `acknowledged` (bool), `acknowledged_at`
- `snoozed_until` (nullable)
- `created_at`

Free-floating. In-app banners only for v1. v2 considers web push (desktop).

### 5.7 Daily review

**`daily_reviews`**
- `id`, `user_id`, `date`
- `pm_completed_at` (set on End Day)
- `mood` (int 1–5, optional)
- `notes` (text, optional)
- `tomorrows_plan_json` — task IDs committed for tomorrow
- `am_seen_at` (set when AM rundown viewed)

### 5.8 Weekly review *(v0.3+)*

**`weekly_reviews`**
- `id`, `user_id`, `week_starting` (date, Monday)
- `completed_at`
- `commitments_json` — what the user committed to next week (pinned all week)
- `dropped_project_id` (nullable — "one project to drop this week" answer)
- `notes`

### 5.9 Productivity score history

**`productivity_scores`**
- `user_id`, `date`, `score` (int 0–100)
- `breakdown_json` — components (time, habits, tasks, quality) for transparency
- `vs_rolling_avg` (real)

### 5.10 Overwork bank

**`overwork_bank`**
- `user_id` (pk)
- `unbanked_minutes` (int — overwork minutes not yet converted)
- `banked_freeze_credits` (int — converted, not yet spent)

User chooses in settings: overwork goes to credits, to bank, or split (default 50/50).

### 5.11 Pomodoro

**`pomodoros`**
- `id`, `user_id`, `duration_seconds`
- `started_at`, `ended_at`, `completed`
- `linked_time_block_id`, `linked_task_id`

### 5.12 Schedule proposals *(v0.4+)*

**`schedule_proposals`**
- `id`, `user_id`, `proposed_at`
- `proposed_targets_json` — category → minutes based on rolling 4-week median
- `accepted` (bool, nullable)
- `decided_at`

---

## 6. Feature behaviors

### 6.1 Time tracking

- One running block per user (enforced via unique partial index).
- Start → optionally pre-select category, task, habit, project, stated intent.
- Stop → modal: required (category, label, quality), optional (tags, notes, project).
- Manual backfill of past blocks (marked `manual_entry = true`, visible icon).
- Edit/delete any block. `day_status` recomputed for affected dates.
- Long-running detection: at 24h+ elapsed, banner "Suspiciously long block. Forget to stop?" No auto-stop.

### 6.2 Credits — full formula

**Per block on stop:**
```
duration_hours = (end_at - start_at) / 3600
base = duration_hours × category.base_credit_rate
quality_mult = { useful: 1.0, chores: 0.5, meh: 0.5, wasted: 0.0 }[quality]
block_credits = base × quality_mult
```

**Variable bonus (1 random block per ISO week):**
- When a block stops with `quality = useful` and no bonus has fired this week, with adaptive probability based on expected-blocks-this-week, apply `random_bonus_applied = true` and 1.5× credits.
- Notification on bonus fire: "Lucky block — 1.5× credits."

**Daily multiplier (on End Day):**
```
if goal_hit_percent >= 100: day_mult = 1.5
elif goal_hit_percent >= 80:  day_mult = 1.2
else:                          day_mult = 1.0
day_credits_earned = sum(block_credits for non-free-time) × day_mult
```

**Weekly bonus (Sunday recalc):**
```
days_hit_100 = count of days this week with goal_hit_percent >= 100
if days_hit_100 >= 5: week_bonus = 30 min
elif days_hit_100 >= 3: week_bonus = 15 min
```

**Daily soft cap:**
- Credits earned per day cap at `1.5 × sum(target_minutes × base_credit_rate for non-free-time)`.
- Beyond cap: banner "Diminishing returns: daily cap reached. Rest." Credits still log; UI signals the ceiling.

**Spending:**
- Free-time category blocks subtract from balance.
- Balance can go negative. UI shows muted red. No enforcement.
- Live balance = `sum(earned) - sum(spent)` across all history.

### 6.3 Productivity score (0–100)

```
time_component    = 0.4 × min(100, goal_hit_percent)
habit_component   = 0.3 × habits_completion_percent
task_component    = 0.2 × task_completion_score
quality_component = 0.1 × quality_score

productivity_score = round(sum)
```

Where:
- `task_completion_score` = (completed today / scheduled today) × 100. If nothing scheduled, 100.
- `quality_score` = (useful_minutes / (useful + chores + meh + wasted)) × 100. **Chores** = daily upkeep (cook, clean, laundry, bath). **Meh** = low-focus time at half credit.

**Display:**
- Single number on dashboard.
- Below it: "vs 7-day avg: +5" (green) or "−12" (muted red).
- **Rolling 7-day average is the *primary* number on the dashboard**, today's score is secondary. ADHD-aware: one bad day must not visually dominate.
- Tap for component breakdown.

Weights configurable in settings.

### 6.4 Red-day logic

```
day_score = 0.7 × time_goal_percent + 0.3 × habits_percent
is_red = day_score < red_day_threshold  (default 70)
```

Off days and vacations excluded from red-day calc and from rolling averages.

Always shown alongside 7-day and 30-day rolling averages.

### 6.5 Overwork

**Detection:**
- Daily work goal = sum of `target_minutes_per_day` for work-flagged categories (Deep work + Regular work + Admin + Learning by default).
- Overwork minutes = max(0, tracked_work_minutes − daily_work_goal).

**Soft cap:**
- Overwork beyond +50% of goal stops earning bonuses. Banner shown.

**Conversion (user setting, default 50/50):**
- Half → free-time credits (1:1 minute).
- Half → overwork bank (480 min = 1 freeze credit).
- User can rebalance in settings or convert manually.

### 6.6 Off days

- Accrual: every 6 "engaged" days (`ended_at` set OR `goal_hit_percent ≥ 50`), +1 to `available`.
- **Cap at 5 banked.** Beyond cap, accruals forfeited and logged in `lifetime_forfeited`. Dashboard surfaces this: "You've forfeited 3 off days because you weren't resting. Take one now?"
- Mark today off → `is_off_day = true`, `available -= 1`. Inserted into `off_day_uses`.
- Off days excluded from red-day calc and rolling averages.
- Off days do not earn credits.
- Soft nudge at `available >= 4`: "When did you last actually rest?"

### 6.7 Tasks

**Create:** title + estimate required. Optional: category, project, due/scheduled, urgency, importance, description.

**Today view:** tasks where `scheduled_date = today` OR `due_date = today` OR `status = in_progress`. Sorted Q1 → Q2 → Q3 → Q4, then due date.

**Backlog view:** all `status = backlog`, sortable.

**Eisenhower view (dedicated tab inside Tasks):**
- 2x2 grid: Q1 (urg+imp), Q2 (not urg, imp), Q3 (urg, not imp), Q4 (neither).
- Drag between quadrants → updates urgency/importance (1/1, 3/1, 1/3, 3/3).
- Within-quadrant drag-reorder updates `sort_order`.
- Card shows: title, estimate, project tag, due date, reschedule count badge if ≥3.

**Completed view:** last 30 days visible. Older → archived (kept in DB forever, hidden from default).

**Task → time block linking:**
- "Start working" on a task → starts a time block with `task_id` set.
- Task's `actual_minutes` = sum of linked blocks.
- On completion: "Estimated 60, actual 95 (+58%)."

### 6.8 Habits

**Today checklist:** habit name, X/target progress bar, +1 button, "Complete" button.

**Weekly heatmap:** rows = habits, cols = 14 days, colored cells.

**Streaks:** current, longest, **days_hit_last_30** (frequency-over-consecutive — primary metric per ADHD design). Freezes shown as ❄ on rescued days.

### 6.9 Reminders

- Create with title + datetime, optional recurring.
- Bell icon in header with count of due/overdue unacknowledged.
- Active reminder banner on any screen until acknowledged.
- Snooze: 10 min, 1 hr, tomorrow.
- v1: in-app only.

### 6.10 End Day button

Central daily ritual. Big button at bottom of Today screen.

**On click:**
1. Stop any running block (with stop modal).
2. Open PM Review screen.

### 6.11 PM Review (on End Day)

**Shows:**
- Today's productivity score with vs-avg delta.
- Stats: hours per category vs goal, % hit, credits earned/spent/banked.
- Habits: which hit, which missed (freezes auto-applied where relevant).
- Variable bonus notification if it fired.
- Overwork summary.

**Asks (sequential, one screen):**
1. **Incomplete scheduled tasks:** for each, [Reschedule to tomorrow] [Pick date] [Drop]. Drop requires `drop_reason`. Increments `reschedule_count`.
2. **Mood (optional):** 1–5 numeric.
3. **Notes (optional):** free text.
4. **Tomorrow's top 3:** pick from existing tasks or quick-add. Saved to `tomorrows_plan_json`.

**Submit:**
- Sets `pm_completed_at`, `ended_at`.
- Recomputes daily multiplier and final credits.
- Triggers weekly bonus recalc on Sunday.

### 6.12 AM Rundown (next day first open)

Triggered on first app open after a day where `ended_at` was set.

**Shows:**
- Date.
- Yesterday recap: score, credits, habits hit/missed.
- **Tomorrow's top 3 from last night** pinned at top of today's tasks.
- **This week's commitments from Sunday retro** pinned below top 3 *(v0.3+)*.
- Today's scheduled tasks (Eisenhower-sorted).
- Today's due tasks.
- Today's habits.
- Reminders due today.
- Credit balance.
- "Start day" button → sets `am_seen_at`.

**Edge cases:**
- Didn't End Day yesterday: AM rundown shows "Yesterday wasn't closed. Close it now?" Forces a quick close-out.
- Multiple unclosed days: summary of all, batch-close option.

### 6.17 Weekly Rundown *(v0.2+, Google Calendar read in same phase)*

A dedicated **Week** screen section (or sub-view) that helps you close the current week and prep the next — distinct from the Sunday **Weekly Retrospective** (§6.13), which is reflective; this is operational.

**Part A — This week (current ISO week, Mon–Sun):**
- Per-day summary: goal-hit %, productivity score, red/off-day flags, End Day closed or not.
- Week average score (excluding off days and vacations from averages, per §6.6).
- Total tracked time by category vs schedule goals.
- Off days marked this week, with **revert** (“Not an off day”) per day.
- Open tasks still scheduled this week (not completed / not dropped).

**Part B — Next week prep (upcoming Mon–Sun):**
- **Internal tasks:** everything with `scheduled_date` or `due_date` in next week, Eisenhower-sorted, with estimates summed → “You’ve planned ~Xh” vs daily work goal.
- **Google Calendar (read-only, v0.2):** after OAuth connect in Settings, pull events for next week from one or more selected calendars. Show as a read-only agenda alongside internal tasks (no auto time-block creation in v0.2). User can mentally map “meetings + deep work blocks” before the week starts.
- Optional quick actions: reschedule a task to a day next week, mark a day as tentative off day (does not spend off-day bank until confirmed).

**When to show:** always available from Week tab; optional banner Sunday evening / Monday AM: “Review this week & prep next.”

**Google Calendar scope in v0.2 (spec intent):**
- OAuth 2.0, store refresh token encrypted per user.
- Read events in date range only; no write-back.
- Settings: connect/disconnect accounts; show events on Week / Today / AM rundown.

**As built in this repo (v0.2 complete — see §9 and `docs/v0.2-phase.md`):**
- **Separate OAuth** from Auth.js magic-link login (`/api/google-calendar/*`, not the Google provider on NextAuth).
- **Multiple Google accounts** per user (`google_calendar_accounts`, unique on user + email).
- **All calendars** on each connected account (no per-calendar picker UI — reduces settings friction; edu clutter filtered by title).
- **Encrypted refresh tokens** (`GOOGLE_TOKEN_ENCRYPTION_KEY`, AES-256-GCM in `web/src/lib/token-crypto.ts`).
- **15-minute DB cache** per user + date range (`google_calendar_event_cache`); poll every 15 min while app is open; on fetch failure, **serve stale cache** with warning.
- **Title filters:** built-in patterns (office hours, OH, drop-in, TA office, …) always applied; optional extra lines in `user_preferences.calendar_exclude_patterns` (Settings). Post-fetch only — Calendar API cannot exclude by title in the query.
- **Surfaces:** Week (this week + next week), Today calendar peek, AM rundown today/tomorrow.

**Not in v0.2:** per-calendar toggles, creating events from Time Keeper, write-back, conflict resolution, idle detection from calendar.

**v1.0+** expands optional write-back (“block focus time on calendar”) and smarter merge with `time_blocks`.

### 6.13 Weekly Retrospective (Sunday) *(v0.3+)*

Triggered Sunday evening or first open Monday.

**Shows (auto-generated):**
- Total tracked time across categories.
- Tasks completed / dropped / rescheduled.
- Most-rescheduled task (the "avoidance" highlight).
- Estimate accuracy ratio with trend vs last 4 weeks.
- Productivity score average for the week.
- Stale projects: any project with no tracked time in 14+ days flagged for decision.

**Asks:**
1. **What's one project to drop or pause?** (Pick from active projects, or "none.") Records into `weekly_reviews.dropped_project_id`. If picked, prompt to actually flip the project to `retired` with a reason.
2. **What's one habit to change next week?**
3. **Three commitments for the week ahead** — pinned to AM rundown all week.

### 6.14 Silent timer

- Free-form duration or presets (15, 25, 45, 60, 90 min).
- Silent: no ticking, no sound, no system notification.
- On end:
  - Subtle visual flash (page background pulses).
  - Optional vibration on mobile (single pulse, can disable).
  - Optional desktop notification (off by default).
- Runs in service worker (persists across tab close).
- Optional: bind to a tracked block. On completion, prompts to log as time_block.

### 6.15 ADHD-targeted features (phased — see §9)

**A. Scope reality check** *(v0.3+, needs ~10 completed tasks for accuracy data)*
On task creation, if user has ≥10 completed tasks: show their personal estimate multiplier and the adjusted estimate. "30 min → likely 69 min based on your history." Informational only.

**B. Daily capacity limit** *(v0.3+)*
At start of day, sum today's scheduled tasks' estimates × accuracy multiplier. If > daily work goal × 0.8: "You've scheduled 9.2h of work, goal is 8h. Cut something." Inline warning on Today screen, dismissable.

**C. "What's next" button** *(v0.2, ships with tasks)*
Single button on Today screen. App picks the highest-Eisenhower-quadrant task scheduled for today, displays full-screen, big "Start working" button. Eliminates decision fatigue.

**D. Quick add** *(v0.2)*
Global keyboard shortcut (Ctrl/Cmd+K) opens single text field. Type "fix login bug 30m important due fri" → regex-parses into title, estimate, importance, due date. Confirm before save. No LLM needed for v0.2; pure regex.

**E. Project staleness alerts** *(v0.3+)*
Projects with no `time_blocks.project_id` activity in 14+ days flagged on dashboard: "DistLearn: no activity in 18 days. Continue, pause, or retire?" Click leads to project decision modal.

**F. Weekly retrospective** *(v0.3, see §6.13)*

**G. Weekly commitments on Today** *(v0.3, see §6.12)*

**H. Body doubling proxy** *(v0.4+)*
When starting a deep work block, optional text field: "What are you doing in this block?" Stored as `time_blocks.stated_intent`. App pings at user-configured intervals (off / 30 / 60 / 90 min): "You said you'd be doing X. Still on it?" Non-blocking banner.

**I. Frequency over consecutive streaks** *(v0.3, see §6.8)*
`days_hit_last_30` is the headline habit metric, not `current_streak`.

**J. Realistic schedules from data** *(v0.4+)*
After 4 weeks of tracking, app generates a proposal: "Your median is 4.2h deep work/day. Propose 5h as new target?" Stored in `schedule_proposals`. User accepts or dismisses. Recurs every 4 weeks.

**K. Graceful retire button** *(v0.2 for tasks, v0.3 for projects)*
On any task: "Drop" button with required `drop_reason` (1-sentence text). On any project: "Retire" button with required `retired_reason`. Settings → "Retirement patterns" view shows aggregate stats on what you drop and why. Self-knowledge, not self-blame.

### 6.16 Analysis views

**Today:** running stats + block list.

**Week:** 7-day summary (goal-hit, score, off days with revert), week average; **Weekly Rundown** (§6.17) for current week + next-week prep (internal tasks + Google Calendar read).

**Month:** calendar with score-colored dots, time per category, tag breakdown, quality distribution, score trend line.

**All-time:**
- Rolling 7-day productivity score line.
- Cumulative credits earned/spent.
- Longest green streak, current streak, days_hit_last_30 per habit.
- Estimate accuracy trend (actual/estimate ratio per task). Target = 1.0.
- Top 10 tasks/projects by tracked time.
- Most-rescheduled tasks (avoidance list).
- Quality distribution over time.
- Retirement patterns *(v0.3+)*: aggregated drop/retire reasons clustered loosely.

### 6.17 Settings

- Categories CRUD.
- Projects CRUD.
- Schedule goals per category.
- Red-day threshold (50–90, default 70).
- Productivity score weights (must sum to 1.0).
- Overwork split (credits / freeze bank percentages).
- Off-day weekly accrual rate (default 1 per 6 engaged days).
- Off-day cap (default 5).
- Habit freeze monthly grant per habit (default 2).
- Body doubling ping interval (off / 30 / 60 / 90).
- Timezone.
- Theme (dark default).
- Sound prefs.
- Export: JSON (all data), CSV (time_blocks, tasks). Download.
- Import: paste JSON.
- Share with friend *(v0.5)*: read-only link.

---

## 7. UX

- **Bottom nav (mobile):** Today / Tasks / Habits / Stats / More.
- **Today is default home:** running timer (if any), pinned top-3, week commitments, today's tasks/habits/reminders, End Day button.
- **Sticky elapsed timer in header** when block is running.
- **AM rundown:** modal sheet over Today on first open of new day.
- **PM review:** dedicated screen via End Day.
- **Weekly retro:** dedicated screen, Sunday/Monday.
- **Eisenhower:** sub-tab inside Tasks.
- **Dark mode default.**
- **Mobile-first.** Big tap targets for Start/Stop and End Day.
- **No emoji-heavy UI.** Numbers and minimal iconography.
- **ADHD-friendly defaults:**
  - Rolling averages above today's score on dashboard.
  - Freezes shown as "available rescues."
  - Variable bonus notifications celebrate, never punish absence.

---

## 8. Edge cases

| Case | Behavior |
|---|---|
| Block spans midnight | Split at midnight in user TZ for accounting; UI shows as one block. |
| TZ change | Past data in UTC, displayed in current TZ. Recompute lazily. |
| Edit past block in prior week | Recompute that day's status + dependent rollups. |
| Block running >24h | Banner only, no auto-stop. |
| Negative credits | Display muted red, no enforcement. |
| Two devices both start timer | Last-write-wins. Stale device sees "started elsewhere, refresh" banner. |
| Delete category with blocks | Force reassign first. |
| Habit completed late but same day | Allowed within user-TZ calendar day. |
| Backfill habit on prior day | Logged but does not retroactively rescue streak. |
| User skips End Day for days | AM rundown nags to close prior days. Batch close option. |
| Two tasks one block | Not allowed. |
| Habit +1 past target | Logged as extra, no extra score. |
| All freezes used + miss again | Streak resets normally. Toast: "Out of freezes. Reset to 0." |
| User stockpiles 5 off days, doesn't use | Forfeit additional accruals, surface forfeit count. |
| User retires a project with active tasks | Modal: "X has N open tasks. Drop all / reassign / cancel." |
| Body doubling intent ping mid-meeting | Banner only, dismissable, no sound by default. |

---

## 9. Phasing & roadmap

### v0.1 — MVP (3–4 focused days, ~1 week calendar time)
**Goal:** start using it.

- Auth (magic link via Resend)
- Categories: seeded defaults + CRUD
- Time tracking: start/stop with category, label, quality
- Manual backfill of past blocks
- Today view: running timer + today's block list + totals
- Basic credits per block (no multipliers yet)
- PWA manifest + install prompt
- Toasts: bottom placement (does not obscure top nav)
- Optional focus-session countdown presets + custom minutes (client-side; not §6.14 Pomodoro persistence)
- Mobile responsive
- GitHub Actions: typecheck + lint on PRs (workflow in repo; enable on remote)

> **Weekend ship: if running out of time, cut PWA install, manual backfill, and credits. The absolute minimum is auth + start/stop + today view. You can use that Monday.**

Use for 5–7 days. Note pain points. Then v0.2.

#### v0.1 implementation status (this repo, `web/`)

The following are **implemented** in the Next.js app under `web/`: Resend magic link auth; Drizzle + Turso with Auth.js tables, `categories`, `time_blocks` (including partial unique index for one running block per user); seeded default categories + CRUD; start/stop with label and quality; manual backfill; edit/delete blocks; Today view with running **elapsed** time when no focus goal is chosen, or **only** a focus **countdown** when a preset (25 / 45 / 60 / 90) or **custom minutes** was set before Start; calendar headline and credits from a server snapshot (hydration-safe); per-block credits only (no multipliers); PWA manifest, service worker, dynamic `/icon`; minimal header nav (Today · Categories · Sign out); Sonner toasts **bottom-center** so they do not cover the top bar; focus session stored in `localStorage` by block id — not the full §6.14 silent Pomodoro + service-worker timer; that remains v0.3).

**CI:** `.github/workflows/ci.yml` exists (Node 20, `working-directory: web`, dummy env for build). Confirm it runs on GitHub after push and enable Actions if needed.

**Not in v0.1:** Week/month/all-time **history** and Stats tab content are scheduled in **v0.2+** (see §6.16 and §9). Today only lists blocks that **overlap the current calendar day** in the user’s timezone.

### v0.2 — Tasks + Schedule — **COMPLETE** (`main`, May 2026)
**Goal:** scheduling, the End Day loop, and basic ADHD ergonomics.

**Shipped checklist** (all items below are in `web/` on `main`):

- Schedule goals per category
- Day status calculation + red-day logic
- **Rolling 7-day average as primary dashboard metric**
- Weekly view + **Weekly Rundown** (partial §6.17: per-day scores, off-day revert, next-week tasks + GCal)
- **Google Calendar read-only** (multi-account, all calendars, title filters — §6.17 “as built”)
- Tasks: create with required estimate, list (Today + Backlog), complete, link to time blocks
- Task estimate-vs-actual on completion
- Free-time category spending (display)
- End Day button + basic PM Review
- **Stats** `/stats` — 30-day history (completed/dropped tasks, End Day notes, time blocks)
- Quality ratings **chores** + **meh** (0.5× multiplier)
- Offline reads via service worker
- **"What's next" button** (ADHD feature C)
- **Quick add via Ctrl/Cmd+K** with regex parsing (ADHD feature D)
- **Graceful drop button on tasks** with required reason (ADHD feature K, partial)

#### v0.2 implementation status (this repo, `web/`)

**Authoritative detail:** [`docs/v0.2-phase.md`](docs/v0.2-phase.md) — routes, migrations, Google Calendar rationale, env vars, spec deltas.

**Migrations:** `0001` tasks/schedule, `0002` day status, `0003` quality chores/meh, `0004` google calendar tables, `0005` `user_preferences.calendar_exclude_patterns`. Always run `cd web && npm run db:migrate` after pull.

**Routes:** `/today`, `/week`, `/tasks`, `/categories`, `/stats`, `/settings`.

**Partial vs spec (intentional, do not “fix” without user ask):**
- Weekly Rundown Part A lacks full “time by category vs goals” chart on Week.
- No per-calendar include/exclude UI — all calendars per account; use title filters for `.edu` office hours.
- AM rundown exists but not full §6.12 (tomorrow top 3 pinning, batch close unclosed days) — v0.3.

**Next phase:** v0.3 only (§9 below). Do not implement v0.3+v0.4 in one pass.

### v0.3 — Habits, Rituals, ADHD core (5–7 days) — **NEXT**
**Goal:** the full daily/weekly loop and the ADHD features that need data to work.

- Habits: CRUD, today checklist, weekly heatmap
- Streak freezes (2/month/habit, cap 5)
- **`days_hit_last_30` as primary habit metric** (ADHD feature I)
- AM Rundown
- PM Review enhanced (mood, notes, tomorrow's top 3 pinning)
- Silent countdown timer
- Monthly view + score trend line
- Off days with cap-5 stacking + nudge at 4+
- Daily and weekly credit multipliers
- Productivity score (0–100) + vs rolling avg
- Variable reward bonus (1/week)
- Overwork detection + split between credits and freeze bank
- Projects CRUD + project tagging on time blocks/tasks
- **Project staleness alerts** (ADHD feature E)
- **Weekly Retrospective** (ADHD feature F)
- **Weekly commitments pinned on Today** (ADHD feature G)
- **Scope reality check on task creation** (ADHD feature A) — activates at ≥10 completed tasks
- **Daily capacity limit warning** (ADHD feature B)
- **Graceful retire button on projects** with required reason (ADHD feature K, full)
- Retirement patterns view in stats

### v0.4 — Prioritization + Reminders (4–6 days)
**Goal:** the Eisenhower view, reminders, and the ADHD features that need 4+ weeks of data.

- Eisenhower 2x2 with drag-drop
- Within-quadrant ordering
- Reminders (free-floating, in-app banners, snooze)
- Tags on tasks and time blocks
- Vacations (pre-apply with date range)
- Export (JSON + CSV) and import (JSON)
- Settings polish (all knobs exposed)
- **Body doubling proxy** (ADHD feature H)
- **Realistic schedule proposals every 4 weeks** (ADHD feature J)

### v0.5 — Sharing + Polish (3–5 days)
**Goal:** share with friends, smooth edges.

- Read-only share links
- Friend invite flow
- Estimate accuracy insights (full trend)
- Most-rescheduled "avoidance report"
- Habit freeze redemption from overwork bank UI
- Performance pass: indexes, query optimization

### v1.0+ — Future (not committed)
- Google Calendar **full** integration (multi-account, optional write-back, focus-block export)
- Web push notifications (desktop)
- Smart suggestions ("you usually do deep work in mornings")
- AI-generated weekly summary
- Native mobile if PWA proves insufficient

### Total estimate
**18–27 focused days.** Add 30% for the universal underestimation tax: **24–35 days realistic.** Spread over 8–14 weeks given your other commitments (CSCI 544/576, DistLearn, Callback, job apps).

**Your stated plan:** v0.1 first, then DistLearn, then return for v0.2. Calendar-wise, this means v0.1 next weekend, DistLearn through end of May, v0.2 mid-June. Plan accordingly.

---

## 10. Handoff to coding agent

**Current state (May 2026):** v0.1 and **v0.2 are complete** on `main`. Read this spec + [`tech_setup_v2.md`](tech_setup_v2.md) + phase docs [`docs/v0.1-phase.md`](docs/v0.1-phase.md) and [`docs/v0.2-phase.md`](docs/v0.2-phase.md).

1. Implement **only the next phase** (currently **v0.3** per §9), then stop for dogfooding.
2. **Do not** rebuild v0.2 Google Calendar as Auth.js Google provider — calendar OAuth is intentionally separate (see `docs/v0.2-phase.md` §2).
3. Run migrations after schema changes: `cd web && source .env.local && npm run db:migrate`.
4. Match existing patterns: server actions, Drizzle schema, design tokens in `globals.css`, Sonner toasts bottom-center.
5. When v0.3 ships, add `docs/v0.3-phase.md` and update §9 status the same way v0.2 was closed out.

**Do not** let the agent build the whole spec in one pass. The cost isn't tokens — it's that rebuilding wrong abstractions later costs more than building correctly the second time.

The spec is a north star. Most of v0.4 and v0.5 may never ship; that's acceptable. Ship one phase, use it, then the next.
