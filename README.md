# Time Keeper

A personal productivity PWA that combines time tracking, task management, habit tracking, a daily review ritual, and ADHD-aware gamification. Built as a single-user app (friend-shareable later) that runs on free tiers indefinitely.

[![CI](https://github.com/BHUVAN-RJ/Time-Keeper/actions/workflows/ci.yml/badge.svg)](https://github.com/BHUVAN-RJ/Time-Keeper/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black)
![React 19](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Routes](#routes)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Scoring and credits](#scoring-and-credits)
- [Database migrations](#database-migrations)
- [Deployment](#deployment)
- [CI](#ci)
- [Development workflow](#development-workflow)
- [Roadmap and status](#roadmap-and-status)
- [Documentation index](#documentation-index)
- [License](#license)

---

## Why this exists

Built by and for someone with ADHD. Three principles shape every decision:

1. **Soft failure modes, not punishments.** Strict streak resets cause abandonment. Habit freezes are mandatory, rolling averages sit next to daily scores, and one bad day never erases a week.
2. **Visible progress, immediate feedback.** Credits, scores, and stats update live. The End Day ritual closes a clean loop: work, log, see the score.
3. **Self-knowledge over self-discipline.** The app's main value is showing where time actually goes: estimate vs actual, time per task, quality distribution. Data beats nags.

---

## Features

### Time tracking
- One running block per user, enforced by a partial unique index in the database.
- Start with an optional category, task, habit, project, or stated intent. Stop through a modal that requires category, intent, and quality.
- Server-backed focus countdown (`focus_target_minutes`) with presets (25 / 45 / 60 / 90) or custom minutes.
- Manual backfill and full edit/delete of past blocks. Idle running timers auto-stop.
- Quality ratings: `useful`, `chores`, `meh`, `wasted`.
- Business day runs **04:00 to 04:00** in the user's timezone. Late-night activity belongs to the previous date, and unclosed days auto-close silently at the boundary.
- Wasted-time tracking: untracked gaps inside a configurable active window count against the day's score. No blocks are created, so backfilling a block automatically reduces wasted time.

### Tasks
- Required estimate on every task, plus deadlines, urgency, importance, category, project.
- Views: Today, Remaining (all open tasks, overdue first), Backlog, and an **Eisenhower 2x2 matrix** with drag-and-drop between and within quadrants.
- Start a time block directly from a task. Actual minutes roll up from linked blocks and the estimate-vs-actual delta shows on completion.
- Graceful drop with a required reason. Retirement patterns aggregate on `/stats`.
- Quick add with `Ctrl/Cmd + K`: `fix login bug 30m important due fri` is regex-parsed into title, estimate, importance, and due date.
- "What's next" button picks the highest-priority task for today and offers a one-tap start.
- Scope reality check (personal estimate multiplier after 10 completed tasks) and daily capacity warning.

### Habits
- Today checklist with per-habit progress, +1, and complete.
- 14-day heatmap. Streaks with **frequency over consecutive** as the headline metric (`days_hit_last_30`).
- Streak freezes: monthly grant, overwork conversion, auto-apply on a missed day, capped per habit.
- Stopping a time block allocated to a habit auto-completes that habit for the day.

### Rituals
- **End Day**: stops any running block, opens the PM review (score, category hours vs goals, credits, habits, mood, notes, tomorrow's top 3, resolution of incomplete tasks).
- **AM rundown**: on first open of a new day, shows yesterday's recap, pinned top 3, weekly commitments, today's tasks, habits, reminders, and calendar. Nags to batch-close unclosed days.
- **Weekly retrospective** on the Week page: tracked time, completed/dropped/rescheduled tasks, most-rescheduled task, estimate accuracy trend, stale projects, and three commitments for the week ahead.
- **Weekly rundown**: this week's per-day summary plus next-week prep with internal tasks and Google Calendar events side by side.

### Projects, reminders, tags, vacations
- Projects with status, tracked hours, staleness alerts (14+ days without activity), and retire-with-reason.
- Reminders with recurrence, snooze, a header bell, and a global banner.
- Optional tags on tasks and blocks (toggle in Settings).
- Vacations and off days excluded from red-day logic and rolling averages. Off-day bank capped at 5 with forfeit reporting.
- Body doubling proxy: state your intent on a deep-work block and get periodic "still on it?" pings.

### Rewards
- Quality-weighted credits per block, allocation bonuses (2x task, 2x habit, 3x project), a random 1.5x "lucky block" once per week, daily and weekly multipliers on End Day.
- Productivity score (0 to 100) with the **7-day rolling average as the primary dashboard number**.
- Overwork splits between free-time credits and a freeze bank (user-configurable).
- `/shop`: symbolic point redemptions with history.

### Integrations and platform
- **Google Calendar (read-only)**: multiple accounts per user, all calendars, encrypted refresh tokens, 15-minute cache with stale fallback, title-based exclusion filters.
- **PWA**: manifest, service worker with offline shell and API cache, dynamic icon route. Installable on iOS via Add to Home Screen.
- Passwordless auth via magic link (Auth.js + Resend).
- Optimistic UI everywhere: mutations apply instantly on the current device and sync to the database in the background; tab switches never block on the network.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, Radix UI primitives, `lucide-react`, design tokens in `web/src/styles/design-tokens.ts` |
| Backend | Next.js server actions and route handlers (no separate service) |
| Database | Turso (libSQL) via `@libsql/client` |
| ORM | Drizzle ORM, `drizzle-kit` for migrations |
| Auth | Auth.js v5 (`next-auth`) with Resend magic-link provider and Drizzle adapter |
| Client state | Zustand (timer, modals, ephemeral UI) |
| Server state | TanStack Query 5 (cache, optimistic updates) |
| Dates | `date-fns` and `date-fns-tz` |
| Drag and drop | `dnd-kit` |
| Toasts | Sonner (bottom-center) |
| Hosting | Vercel |
| CI | GitHub Actions |

Runtime target: Node 22 (`engines` in `web/package.json`). CI currently runs on Node 20.

---

## Repository layout

```
.
├── web/                        Next.js application (the deployable unit)
│   ├── src/
│   │   ├── app/                App Router pages, layouts, API routes
│   │   │   ├── (app)/          Authenticated routes (today, week, tasks, ...)
│   │   │   ├── api/            Auth.js handlers, Google Calendar OAuth
│   │   │   ├── login/          Magic-link sign-in
│   │   │   └── privacy/ terms/ Legal pages for OAuth verification
│   │   ├── actions/            Server actions, one file per domain
│   │   ├── components/         Client components
│   │   ├── db/                 Drizzle schema and client
│   │   ├── lib/                Pure domain logic (credits, scores, day boundary, ...)
│   │   │   ├── google-calendar/
│   │   │   ├── mutations/      Optimistic mutation helpers
│   │   │   └── queries/        React Query keys and fetchers
│   │   ├── styles/             Design tokens
│   │   └── auth.ts             Auth.js configuration
│   ├── drizzle/                SQL migrations 0000 to 0016
│   ├── scripts/                db-reset, migrate-env
│   ├── public/                 manifest.json, sw.js, brand assets
│   └── README.md               App-level setup notes
├── specs/                      Spec Kit feature folders (spec, plan, tasks, contracts)
│   ├── 001-timer-fixes-day-rollover/
│   ├── 002-reactive-async-ui/
│   └── 003-rewards-sync-shop/
├── Time-keeper/                Design canvas prototypes (JSX artboards, not shipped)
├── .specify/                   Spec Kit configuration, templates, and scripts
├── .cursor/                    Cursor agent rules and Spec Kit skills
├── .github/workflows/ci.yml    Typecheck, lint, build
├── spec_v4.md                  Product specification (the north star)
├── tech_setup_v2.md            Accounts, environment, CI/CD, deployment walkthrough
└── LICENSE                     MIT
```

---

## Getting started

### Prerequisites

- Node 22 and npm
- A Turso database (`turso db create time-keeper-dev`) and auth token
- A Resend API key (magic-link email)
- Optional: Google Cloud OAuth client for Calendar read access

`tech_setup_v2.md` walks through creating every account.

### Install and run

```bash
git clone https://github.com/BHUVAN-RJ/Time-Keeper.git
cd Time-Keeper/web
cp .env.example .env.local     # fill in values (see below)
npm ci

# apply migrations to the database in .env.local
source .env.local
npm run db:migrate

npm run dev                    # http://localhost:3000
```

The root route redirects to `/login`, or straight to `/today` if a session exists. Sign in with any email; the magic link arrives through Resend. Default categories and schedule goals are seeded on first sign-in.

### Reset a development database

```bash
cd web && source .env.local && npm run db:reset
```

This drops every application table and re-applies all migrations. Never point it at production.

---

## Environment variables

Defined in `web/.env.example`. Copy to `web/.env.local` for development and `web/.env.production` for the production migration script. Both files are gitignored.

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL` | libSQL connection URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `AUTH_SECRET` | Auth.js session secret (`openssl rand -base64 32`) |
| `AUTH_URL` | Canonical app URL, exact production URL in prod |
| `AUTH_TRUST_HOST` | `true` behind Vercel |
| `RESEND_API_KEY` | Resend API key for magic links |
| `AUTH_RESEND_FROM` | Sender address (verified domain in prod) |
| `GOOGLE_CLIENT_ID` | Optional, Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | Optional, Calendar OAuth |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | 32 random bytes, base64, encrypts refresh tokens with AES-256-GCM |

Google Calendar is fully optional. When the three `GOOGLE_*` variables are unset, the Settings page hides the Connect button and no calendar polling runs.

---

## Scripts

Run from `web/`.

| Script | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a Drizzle migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to the database in the current environment |
| `npm run db:migrate:prod` | Load `.env.production` and apply migrations to production |
| `npm run db:reset` | Wipe all app tables and re-migrate (development only) |

---

## Routes

| Route | Purpose |
|---|---|
| `/today` | Running timer, focus countdown, today's blocks, pinned top 3, habits, staleness alerts, End Day |
| `/week` | Per-day summary, off-day revert, weekly rundown, next-week prep, weekly retrospective |
| `/tasks` | Task hub: Today, Remaining, Backlog, Eisenhower matrix, plus Habits and Projects tabs |
| `/habits` | Habit management and 14-day heatmap |
| `/projects` | Project CRUD, tracked hours, retire with reason |
| `/month` | Calendar with score-coloured days, category and quality breakdowns |
| `/stats` | Credits, score trend, estimate accuracy, retirement patterns, 30-day history |
| `/shop` | Symbolic point redemptions and history |
| `/categories` | Category CRUD including archived categories |
| `/reminders` | Reminder list and editing |
| `/settings` | Preferences, schedule goals, overwork split, vacations, tags, body doubling, Google Calendar |
| `/login` | Magic-link sign-in |
| `/privacy`, `/terms` | Legal pages |
| `/api/auth/*` | Auth.js handlers |
| `/api/google-calendar/connect`, `/callback` | Calendar OAuth flow (separate from login) |
| `/icon`, `/brand/logo` | Dynamically rendered PWA icon and logo |

Primary navigation shows Today, Week, Tasks, Shop, Stats, and Settings.

---

## Architecture

**Server actions per domain.** Every mutation lives in `web/src/actions/<domain>.ts` (time blocks, tasks, habits, shop, end day, and so on). Actions authenticate via `auth()`, write through Drizzle, and return plain data.

**Pure domain logic in `lib/`.** Credits, productivity score, red-day logic, day boundary math, wasted time, off-day balance, estimate accuracy, and habit computation are plain TypeScript functions with no framework dependencies. This keeps the maths testable and the actions thin.

**React Query owns server state.** Query keys live in `lib/queries/keys.ts`. Mutations use `setQueryData` for optimistic updates and `invalidateQueries` for reconciliation. Components never call `router.refresh()`. Failed mutations roll back and surface a toast.

**Zustand owns ephemeral client state**: running timer display, modals, quick-add.

**4 AM business day.** `lib/day-boundary.ts` is the single source of truth. All "today" queries, rollups, and auto-close logic derive from `businessDayInTz` and `getBusinessDayRangeUtc`.

**Google Calendar is separate from login.** Calendar OAuth uses its own route handlers and `google_calendar_accounts` table, so a user can attach multiple Google accounts without touching the magic-link identity. Refresh tokens are encrypted at rest (`lib/token-crypto.ts`). Events are cached per user and date range for 15 minutes; on fetch failure the stale cache is served with a warning.

**PWA.** `public/sw.js` caches the app shell and successful `GET /api/*` responses. `manifest.json` points at the dynamic `/icon` route so the icon always matches the brand.

---

## Data model

Full detail lives in `spec_v4.md` §5 and `web/src/db/schema.ts`. Core tables:

| Group | Tables |
|---|---|
| Identity | `users`, `accounts`, `sessions`, `verification_tokens`, `authenticators`, `user_preferences` |
| Time | `categories`, `time_blocks`, `time_block_tags`, `tags`, `schedule_goals` |
| Tasks | `tasks`, `task_tags`, `projects` |
| Habits | `habits`, `habit_completions`, `habit_streaks`, `habit_daily` |
| Rituals | `daily_reviews`, `weekly_reviews`, `day_status`, `productivity_scores` |
| Rest | `off_day_balance`, `off_day_uses`, `overwork_bank` (vacations stored as date ranges in `user_preferences`, flagged on `day_status.is_vacation`) |
| Rewards | `shop_items`, `shop_redemptions` |
| Calendar | `google_calendar_accounts`, `google_calendar_event_cache` |
| Reminders | `reminders` |

Key invariants:

- At most one running `time_blocks` row per user (`end_at IS NULL` partial unique index).
- At most one of `project_id`, `habit_id`, `task_id` per block.
- Four active seeded categories: Deep Work (15 min/hr), Admin / Shallow (5), Cooking / Cleaning (5), Exercise (8). Legacy categories are archived, never deleted, so history keeps its original names.

---

## Scoring and credits

**Per block**

```
hours         = (end_at - start_at) / 3600
quality_mult  = useful 1.0 | chores 0.5 | meh 0.5 | wasted 0.0
alloc_mult    = none 1x | task 2x | habit 2x | project 3x
credits       = hours × category.base_credit_rate × quality_mult × alloc_mult
                × 1.5 if the weekly lucky bonus fired
```

**On End Day**

```
day_mult = 1.5 if goal_hit ≥ 100%, 1.2 if ≥ 80%, else 1.0
```

Weekly bonus on Sunday: +30 min for 5 goal-hit days, +15 min for 3.

**Productivity score**

```
score = 0.4 × min(100, goal_hit_percent)
      + 0.3 × habits_completion_percent
      + 0.2 × task_completion_score
      + 0.1 × quality_score
```

Red day when `0.7 × time_goal_percent + 0.3 × habits_percent < 70` (threshold configurable). Off days and vacations are excluded from red-day logic and rolling averages.

Implementation: `lib/credits.ts`, `lib/allocation-bonus.ts`, `lib/productivity-scores.ts`, `lib/score-breakdown.ts`, `lib/overwork.ts`, `lib/off-day-balance.ts`.

---

## Database migrations

Migrations live in `web/drizzle/` and are applied in order by `drizzle-kit migrate`. Current head: **`0016_early_grim_reaper`**.

| Range | Contents |
|---|---|
| `0000` | Initial schema: auth tables, categories, time blocks |
| `0001` to `0002` | Tasks, schedule goals, day status |
| `0003` | Quality values `chores` and `meh` |
| `0004` to `0005` | Google Calendar accounts, event cache, exclude patterns |
| `0006` to `0008` | Habits, streaks, off-day skip, v0.3 rituals |
| `0009` | Reminders |
| `0010` to `0012` | Tags, vacations, body doubling, tags and reminders preferences |
| `0013` | 4 AM day rollover, wasted time settings |
| `0014` | Project completion |
| `0015` | Timer last-seen (idle auto-stop) |
| `0016` | `time_blocks.habit_id`, `focus_target_minutes`, shop tables |

Workflow for a schema change:

```bash
cd web
# 1. edit src/db/schema.ts
npm run db:generate        # writes a new SQL file to drizzle/
npm run db:migrate         # apply locally
npm run typecheck && npm run lint
```

`0016` was hand-trimmed to delta-only SQL. Do not regenerate it as a full snapshot on an existing database.

---

## Deployment

Target is Vercel (Hobby tier).

1. Import the repo in Vercel and set **Root Directory** to `web`.
2. Add the same environment variables as `.env.local`. `AUTH_URL` must be the exact production URL.
3. Deploy. Vercel builds with `next build` and does **not** run migrations.
4. After any schema change reaches `main`, run migrations against production explicitly:

```bash
cd web && npm run db:migrate:prod    # reads .env.production
```

5. Visit `/shop` once after `0016` so `ensureShopCatalog()` seeds the catalog.

A `Procfile` (`web: npm run start`) is included for Heroku-style hosts.

Keeping migrations out of the build step is deliberate: a bad migration must not break every future deploy.

---

## CI

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build` with placeholder environment values

Run the same locally before pushing:

```bash
cd web && npm run typecheck && npm run lint && npm run build
```

---

## Development workflow

This repo uses **Spec Kit** for feature work. Each feature gets a numbered folder under `specs/` containing:

- `spec.md`: user stories, acceptance scenarios, clarifications
- `plan.md`, `research.md`, `data-model.md`: design decisions
- `contracts/`: server action and cache contracts
- `tasks.md`: ordered implementation tasks
- `quickstart.md`: manual verification scenarios
- `checklists/`: requirement checklists

Templates and helper scripts live in `.specify/`. Cursor skills for the `speckit.*` commands live in `.cursor/skills/`.

Conventions:

- Conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`).
- Server actions plus Drizzle for every write. No direct client-side database access.
- React Query optimistic cache for every mutation. No `router.refresh()` in components.
- Design tokens from `globals.css` and `design-tokens.ts`. Sonner toasts bottom-center.
- Ship one phase, dogfood it, then move to the next. Do not build the whole spec in one pass.

---

## Roadmap and status

| Phase | Status | Highlights |
|---|---|---|
| v0.1 MVP | Complete | Magic-link auth, categories, start/stop, backfill, Today view, PWA |
| v0.2 Tasks and Schedule | Complete | Schedule goals, day status, End Day, Stats, Google Calendar read, quick add, "What's next" |
| v0.3 Habits and Rituals | Complete | Habits, freezes, AM rundown, PM review, month recap, off-day bank, overwork, projects, weekly retro |
| v0.4 Prioritization and Reminders | In progress | Eisenhower matrix, reminders, tags, vacations, body doubling shipped. Export/import and schedule proposals remain |
| 001 Timer fixes and 4 AM rollover | Complete | Timer never locks, 4 AM business day, silent auto-close, wasted time, good-morning screen |
| 002 Reactive async UI | Complete | Optimistic mutations, instant tab switches, async cache sync |
| 003 Rewards, Sync and Shop | Complete | Cross-device AM sync, server focus countdown, allocation bonuses, four categories, `/shop` |
| v0.5 Sharing and Polish | Planned | Read-only share links, avoidance report, freeze redemption UI, performance pass |
| v1.0+ | Not committed | Calendar write-back, web push, smart suggestions |

Intentional deviations from the spec (do not "fix" without discussion): no per-calendar toggle UI (title filters instead), no silent Pomodoro service-worker timer (focus countdown on Today instead), no daily credit soft cap.

---

## Documentation index

| Document | What it covers |
|---|---|
| [`spec_v4.md`](spec_v4.md) | Full product specification: philosophy, data model, feature behaviours, formulas, edge cases, phasing |
| [`tech_setup_v2.md`](tech_setup_v2.md) | Accounts, cost summary, environment, CI/CD workflows, Vercel deploy, PWA config, pitfalls |
| [`web/README.md`](web/README.md) | App-level setup and route summary |
| [`specs/001-timer-fixes-day-rollover/`](specs/001-timer-fixes-day-rollover/) | 4 AM day boundary, timer reliability, wasted time |
| [`specs/002-reactive-async-ui/`](specs/002-reactive-async-ui/) | Optimistic UI and cache contracts |
| [`specs/003-rewards-sync-shop/`](specs/003-rewards-sync-shop/) | Allocation bonuses, shop, multi-device sync, migration `0016` |
| [`specs/003-rewards-sync-shop/implementation-record.md`](specs/003-rewards-sync-shop/implementation-record.md) | Latest shipped feature record and deploy notes |

---

## License

MIT. See [`LICENSE`](LICENSE).
