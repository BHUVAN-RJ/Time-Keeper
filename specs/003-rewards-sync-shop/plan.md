# Implementation Plan: Rewards, Sync & Shop

**Branch**: `003-rewards-sync-shop` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-rewards-sync-shop/spec.md`

## Summary

This feature fixes multi-device sync gaps (good-morning greeting, day-close state, focus countdown direction), adds dual-dropdown time allocation to projects/habits/tasks with multiplicative credit bonuses, simplifies categories to four activity types, enables task completion from the Today home page, renames the intent field copy, and introduces a symbolic points shop.

Technically: extend Drizzle schema (`habitId`, `focusTargetMinutes` on `time_blocks`; `shop_items`, `shop_redemptions` tables), centralize allocation bonus math in `day-compute.ts`, move focus countdown off `localStorage` to server-backed block fields, fix AM/day-close staleness by querying `amRundown` via React Query with focus/refetch invalidation, and add `/shop` route with redemption server actions that deduct from computed balance atomically.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 22

**Primary Dependencies**: Next.js 16 (App Router, Server Actions), React 19, `@tanstack/react-query` 5, Drizzle ORM on libSQL/SQLite, next-auth 5, date-fns-tz 3, Tailwind v4

**Storage**: libSQL / SQLite — schema additions via `drizzle-kit generate` + `migrate`

**Testing**: No automated test runner. Quality gates: `npm run typecheck`, `npm run lint`. Manual verification via `quickstart.md`.

**Target Platform**: Modern browsers (PWA); multi-device sync via server state + React Query invalidation

**Project Type**: Single full-stack Next.js app under `web/`

**Performance Goals**: AM/day-close state consistent within one Today page load after dismiss/close on another device (SC-001/002); countdown devices within 2 s (SC-003); shop redemption < 5 s (SC-007)

**Constraints**: Preserve single running block invariant; allocation is mutually exclusive (project OR habit OR task); shop balance must be computed consistently with stats; optimistic patterns from `002-reactive-async-ui` for task complete and block stop

**Scale/Scope**: ~25 files touched across actions, schema, 4–5 components, 1 new page, 2 migration files, credit math helpers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an **unpopulated template** — no ratified gates.

- **Initial gate (pre-Phase 0)**: PASS (vacuously).
- **Post-design re-check**: PASS — extends existing stack; no new services; shop uses same SQLite + server actions pattern.

No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-rewards-sync-shop/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── allocation-controls.md
│   ├── credits-bonuses.md
│   ├── sync-am-day-close.md
│   ├── focus-countdown.md
│   └── shop-redemptions.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
web/
├── drizzle/
│   └── NNNN_rewards_sync_shop.sql     # NEW migration
├── src/
│   ├── db/schema.ts                   # habitId, focusTargetMinutes, shop tables
│   ├── lib/
│   │   ├── allocation-bonus.ts        # NEW — 2×/2×/3× multiplier helper
│   │   ├── default-categories.ts      # 4 categories only; rename Chores
│   │   ├── ensure-categories.ts       # archive legacy + migration seed
│   │   ├── day-compute.ts             # apply allocation bonus in creditsForDay
│   │   ├── focus-session-storage.ts   # DEPRECATE writes; read server first
│   │   └── queries/keys.ts            # amRundown, shop keys
│   ├── actions/
│   │   ├── time-blocks.ts             # allocation + focus on start/stop
│   │   ├── am-rundown.ts              # unchanged logic; consumed via RQ
│   │   ├── shop.ts                    # NEW — catalog, redeem, history
│   │   ├── habits.ts                  # habit auto-complete from block stop
│   │   └── stats.ts                   # balance includes redemptions
│   ├── components/
│   │   ├── allocation-picker.tsx      # NEW — type + entity dropdowns
│   │   ├── today-client.tsx           # integrate picker, intent copy, focus sync
│   │   ├── today-pinned-top3.tsx      # complete button + mutation
│   │   ├── am-rundown-modal.tsx       # invalidate amRundown on dismiss/close
│   │   ├── focus-mode-view.tsx        # server focus target
│   │   └── shop-client.tsx            # NEW
│   └── app/(app)/
│       ├── shop/page.tsx              # NEW
│       └── today/page.tsx             # pass amRundown initialData to RQ
└── package.json
```

**Structure Decision**: All changes in `web/`. Reuse React Query patterns from feature 002. No new API routes — server actions only.

## Migration Phases (implementation order)

### Phase A — Schema & credit math (foundation)

1. Drizzle migration: `time_blocks.habit_id`, `time_blocks.focus_target_minutes` (nullable int).
2. Drizzle migration: `shop_items`, `shop_redemptions` tables; seed Food Coupon (850) and PS5 (16,500).
3. `lib/allocation-bonus.ts` — `allocationCreditMultiplier(block) → 1 | 2 | 3`.
4. Update `creditsForDay` / `stats.ts` earned calculation to multiply allocation bonus.
5. Category migration: new `DEFAULT_CATEGORIES` (4 only); `ensureDefaultCategories` archives all non-approved names; rename Chores → Cooking / Cleaning for existing users.

### Phase B — Multi-device sync (P1)

1. Add `queryKeys.amRundown` and `useAmRundownQuery` with SSR `initialData` from Today page.
2. `dismissAmRundownAction` / `submitEndDayAction` / `batchCloseUnclosedDaysAction` — invalidate `amRundown` + `today` keys.
3. `AmRundownModal` — read from query cache, not props-only; refetch on `window.focus` / `visibilitychange` (staleTime ~30s).
4. Remove any client-only gating that could re-show good morning before server `amSeenAt` is fetched.

### Phase C — Focus countdown server sync (P1)

1. `startBlockAction` accepts optional `focusTargetMinutes`; persist on block row.
2. `splitRunningBlockAtBoundary` copies `focusTargetMinutes` to new running block.
3. `RunningBlockPrimaryClock` — prefer `running.focusTargetMinutes` from server; fall back to localStorage only during optimistic start window.
4. Clear localStorage focus session once server block id is known.

### Phase D — Allocation UI & habit auto-complete (P1/P2)

1. `AllocationPicker` component: type select → entity select; mutual exclusion clears other FKs.
2. Wire into stop dialog, manual entry, edit block, and optional start flow.
3. `stopBlockAction` accepts `taskId | habitId | projectId` (one non-null); on habit, call `addHabitCountForToday` to meet target.
4. Extend `getTodayData` to return `activeHabits`, `openTasks` for pickers.

### Phase E — Today UX polish (P2/P3)

1. `TodayPinnedTop3` — Done button via `useCompleteTaskMutation`.
2. Rename UI strings: "Label" → "What will you be doing?" (one line); use `statedIntent` on start, `label` on stop per existing schema.
3. Filter category pickers to `archived = false` AND approved names only.

### Phase F — Shop (P3)

1. `/shop` page + nav link.
2. `getShopPageData`, `redeemShopItemAction` with balance check in transaction.
3. Stats page balance: `earned - spent - sum(redemptions)`.
4. Redemption history list on shop page.

## Implementation Status

**Status:** COMPLETE — shipped on branch `003-rewards-sync-shop`, pushed to origin, migration `0016` applied to Turso.

**Record:** [`implementation-record.md`](./implementation-record.md)

**Verification:** `npm run typecheck`, `npm run lint`, and manual scenarios in [`quickstart.md`](./quickstart.md).

**Migration note:** `0016_early_grim_reaper.sql` was trimmed to delta-only SQL before apply (add columns + shop tables). Do not re-run a full drizzle-kit snapshot against existing databases.

## Complexity Tracking

> No constitution violations; section intentionally empty.
