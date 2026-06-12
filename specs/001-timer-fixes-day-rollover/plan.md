# Implementation Plan: Timer Fixes & 4 AM Day Rollover

**Branch**: `001-timer-fixes-day-rollover` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-timer-fixes-day-rollover/spec.md`

## Summary

This feature stabilizes the core timer and reworks the day model of the Time-Keeper web app. The central change is moving the day boundary from local midnight to **4:00 AM** in the user's timezone, with **lazy, silent auto-close** of elapsed days (no manual "Close all days"), and **auto split/restart** of a running timer at the boundary. It also fixes the running-timer "app becomes unusable" defect, makes timer **start optimistic/instant** (local-first, background sync), removes **tags** entirely, **merges categories + free-text label into a single "Label"** dimension (expandable picker, inline create, per-label analysis), adds **task editing** and a **remaining-tasks list**, applies **strikethrough** to completed tasks (all sources) and to passed Google-Calendar items, shows the **good-morning screen on first open after 4 AM**, and introduces a configurable **active window** within which untracked time counts as **wasted** (derived metric, affects the day score; default 9:00 AM–9:00 PM).

The technical approach reuses the existing Next.js App Router + server actions + Drizzle/libSQL stack. Because the app is serverless (no always-on scheduler), "at 4:00 AM" auto-close is implemented as **lazy reconciliation**: on the next server data load after the boundary, the system finalizes any elapsed-but-unclosed 4 AM days and splits any running block.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20

**Primary Dependencies**: Next.js 16.2.6 (App Router, Server Actions, PWA/service worker), React 19.2, Drizzle ORM 0.45 (`@libsql/client`), next-auth 5 (beta), `@tanstack/react-query` 5 (client polling/cache), `zustand` 5, `date-fns` 4 + `date-fns-tz` 3, Radix UI, Tailwind CSS v4, `sonner` (toasts)

**Storage**: libSQL / SQLite (Turso) via Drizzle ORM; migrations via `drizzle-kit` (`npm run db:generate` / `db:migrate`)

**Testing**: No automated test framework is currently configured. Quality gates available: `npm run typecheck` (tsc --noEmit) and `npm run lint` (eslint). Verification for this feature is primarily manual via `quickstart.md` plus typecheck/lint. (Adding a test runner is out of scope but noted as a gap.)

**Target Platform**: Modern web browsers (installable PWA); deployed on a serverless host (no always-on background workers/cron)

**Project Type**: Web application — single full-stack Next.js project under `web/`

**Performance Goals**: Timer start transitions the screen in < 200 ms regardless of server latency (SC-003); existing Today polling cadence (~60 s) preserved

**Constraints**: Serverless runtime ⇒ no guaranteed cron; the 4 AM auto-close MUST be lazy/idempotent (triggered on data loads/actions), not dependent on a scheduled job. Day math MUST be timezone-correct across DST. Optimistic start MUST reconcile with the DB's single-running-block invariant.

**Scale/Scope**: Personal-productivity app, per-user data volumes (hundreds–thousands of blocks/tasks per user); modest concurrency.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is currently an **unpopulated template** (placeholder principles only). There are therefore **no ratified, enforceable gates** to evaluate against.

- **Initial gate (pre-Phase 0)**: PASS (vacuously — no defined principles). Recommendation: ratify a real constitution later; this plan adopts sensible defaults (reuse existing patterns, keep changes minimal and timezone-correct, prefer additive/idempotent migrations).
- **Post-design re-check (after Phase 1)**: PASS — no new principle violations introduced; design stays within the existing architecture (server actions + Drizzle + react-query), adds no new services, and keeps complexity localized to day-math, label consolidation, and the timer state machine.

No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-timer-fixes-day-rollover/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (server-action contracts)
│   ├── timer-actions.md
│   ├── day-rollover.md
│   ├── tasks-actions.md
│   ├── labels-actions.md
│   └── settings-wasted-time.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (already created)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

The feature is implemented entirely within the existing Next.js app at `web/`. Key existing paths that this feature touches or extends:

```text
web/
├── drizzle/                          # SQL migrations (drizzle-kit generate output)
├── src/
│   ├── db/
│   │   └── schema.ts                 # Drizzle schema (categories→Label, user_preferences, day_status, tags removal)
│   ├── lib/
│   │   ├── calendar-day.ts           # calendarDayInTz — add 4 AM-shifted day key
│   │   ├── day-range.ts              # getDayRangeUtc — add 4 AM day range
│   │   ├── day-compute.ts            # minutesOnDay/overlap — 4 AM ranges + wasted-time gaps
│   │   ├── productivity-scores.ts    # factor wasted time into score
│   │   ├── score-breakdown.ts        # surface wasted minutes
│   │   ├── unclosed-days.ts          # 4 AM-based unclosed detection (lazy auto-close source)
│   │   └── (new) day-boundary.ts     # shared 4 AM constants + helpers
│   │   └── (new) wasted-time.ts      # in-window gap computation
│   ├── actions/
│   │   ├── time-blocks.ts            # optimistic start contract, 4 AM split/restart, drop label requirement
│   │   ├── end-day.ts                # silent auto-close path (metrics-only, non-blocking review)
│   │   ├── day-status.ts             # auto-close reconciliation entry point
│   │   ├── am-rundown.ts             # 4 AM-day good-morning gating; offer optional review
│   │   ├── tasks.ts                  # (new) updateTaskAction; remaining-tasks query
│   │   ├── categories.ts             # Label management (inline create, neutral defaults)
│   │   ├── stats.ts / month.ts       # per-label analysis; remove tag breakdown
│   │   └── preferences.ts            # active-window settings; remove tagsEnabled usage
│   └── components/
│       ├── today-client.tsx          # optimistic start; ensure stop/label always interactive
│       ├── focus-mode-view.tsx       # stop/label control reachability fix
│       ├── am-rundown-modal.tsx      # good-morning after 4 AM + optional review entry
│       ├── tasks-client.tsx          # task edit UI; remaining-tasks list; strikethrough
│       ├── calendar-events-list.tsx  # strikethrough passed GCal items
│       ├── settings-client.tsx       # active-window controls; remove tags toggle
│       ├── tag-picker.tsx / tags-settings.tsx  # REMOVE
│       ├── category-* / project-picker.tsx     # relabel "Category" → "Label", expandable picker
│       └── stats-client.tsx          # per-label analysis view
└── package.json
```

**Structure Decision**: Single existing full-stack Next.js project (`web/`). No new top-level projects, services, or packages are introduced. New logic is added as Drizzle migrations, shared `lib/` helpers (day boundary, wasted time), new/extended server actions in `actions/`, and UI changes in `components/`. This keeps the change set cohesive and consistent with current conventions (server actions invoked from client components, react-query for client cache, Drizzle for persistence).

## Complexity Tracking

> No constitution violations to justify; section intentionally empty.
