---
description: "Task list for Rewards, Sync & Shop"
---

# Tasks: Rewards, Sync & Shop

**Input**: Design documents from `/specs/003-rewards-sync-shop/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No automated test framework is configured and tests were not requested in the spec. No test tasks are generated. Verification is via `npm run typecheck`, `npm run lint`, and `quickstart.md` (see Polish phase).

**Organization**: Tasks are grouped by user story (US1–US8) in priority order so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US8 (user story phases only)
- All paths are relative to repo root; app code lives under `web/`

## Path Conventions

- Web app (single Next.js project): server actions in `web/src/actions/`, shared logic in `web/src/lib/`, UI in `web/src/components/`, pages in `web/src/app/(app)/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm branch and baseline before schema work.

- [X] T001 Verify current git branch is `003-rewards-sync-shop` and feature spec exists at `specs/003-rewards-sync-shop/spec.md`
- [X] T002 Run baseline quality gates: `cd web && npm run typecheck && npm run lint`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, credit math, and category migration that MUST complete before user story work.

**⚠️ CRITICAL**: No user story phase should begin until this phase is complete.

- [X] T003 Add `habitId` FK and `focusTargetMinutes` integer columns to `timeBlocks` in `web/src/db/schema.ts`
- [X] T004 Add `shop_items` and `shop_redemptions` tables with relations in `web/src/db/schema.ts`
- [X] T005 Generate Drizzle migration via `cd web && npx drizzle-kit generate` and apply via `npx drizzle-kit migrate`
- [X] T006 Seed shop catalog (Food Coupon 850 pts, PS5 16,500 pts) in the migration SQL under `web/drizzle/` or a one-time seed in `web/src/lib/seed-shop.ts` invoked on boot
- [X] T007 [P] Create `allocationCreditMultiplier()` helper in `web/src/lib/allocation-bonus.ts` per `specs/003-rewards-sync-shop/contracts/credits-bonuses.md`
- [X] T008 [P] Create shared `computeCreditBalance(userId)` in `web/src/lib/credit-balance.ts` (earned − free-time spent − redemptions)
- [X] T009 Apply allocation multiplier in `creditsForDay()` in `web/src/lib/day-compute.ts`
- [X] T010 Refactor `getStatsPageData()` in `web/src/actions/stats.ts` to use `allocation-bonus.ts` and `credit-balance.ts`
- [X] T011 Replace `DEFAULT_CATEGORIES` with four approved categories in `web/src/lib/default-categories.ts` (rename Chores constant to Cooking / Cleaning)
- [X] T012 Update `ensureDefaultCategories()` in `web/src/lib/ensure-categories.ts` to archive non-approved categories and rename existing Chores → Cooking / Cleaning
- [X] T013 [P] Add `amRundown` and `shop` entries to `web/src/lib/queries/keys.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — One greeting and one day-close state everywhere (Priority: P1) 🎯 MVP

**Goal**: Good-morning and unclosed-day prompts are account-level, synced across devices via React Query.

**Independent Test**: Dismiss good morning on device A → device B does not re-show. Close day on device A → device B shows no duplicate close prompt (quickstart §1–2).

### Implementation for User Story 1

- [X] T014 [P] [US1] Create `useAmRundownQuery(initialData)` hook in `web/src/lib/queries/am-rundown.ts` with `staleTime: 30_000` and `refetchOnWindowFocus: true`
- [X] T015 [US1] Pass `getAmRundownData()` as React Query `initialData` from `web/src/app/(app)/today/page.tsx`
- [X] T016 [US1] Refactor `AmRundownModal` in `web/src/components/am-rundown-modal.tsx` to read from `useAmRundownQuery` instead of props-only SSR data
- [X] T017 [US1] Optimistically set `["amRundown"]` to `mode: "hidden"` on dismiss in `web/src/components/am-rundown-modal.tsx`
- [X] T018 [US1] Invalidate `queryKeys.amRundown` and `queryKeys.today` after `dismissAmRundownAction`, `batchCloseUnclosedDaysAction`, and successful end-day close in `web/src/components/am-rundown-modal.tsx` and `web/src/components/end-day-dialog.tsx`
- [X] T019 [US1] Update `TodayClient` in `web/src/components/today-client.tsx` to stop passing static `amRundown` props where query hook supersedes them

**Checkpoint**: US1 independently testable via quickstart §1–2.

---

## Phase 4: User Story 2 — Allocate time to project, habit, or task (Priority: P1)

**Goal**: Dual-dropdown allocation on stop, manual entry, and edit flows; mutually exclusive FKs on blocks.

**Independent Test**: Stop timer → select Task → specific task → block persists link (quickstart §4).

### Implementation for User Story 2

- [X] T020 [P] [US2] Create `AllocationPicker` component in `web/src/components/allocation-picker.tsx` per `specs/003-rewards-sync-shop/contracts/allocation-controls.md`
- [X] T021 [US2] Extend `getTodayData()` to return `activeHabits` and `openTasks` picker lists in `web/src/actions/time-blocks.ts`
- [X] T022 [US2] Extend `stopBlockAction()` with `habitId`/`taskId`/`projectId` mutual-exclusion validation in `web/src/actions/time-blocks.ts`
- [X] T023 [US2] Copy `habitId`, `taskId`, `projectId`, and `focusTargetMinutes` in `splitRunningBlockAtBoundary()` in `web/src/actions/time-blocks.ts`
- [X] T024 [US2] Wire `AllocationPicker` into stop dialog state in `web/src/components/today-client.tsx`
- [X] T025 [US2] Wire `AllocationPicker` into manual block entry dialog in `web/src/components/today-client.tsx`
- [X] T026 [US2] Wire `AllocationPicker` into edit-block dialog in `web/src/components/today-client.tsx`
- [X] T027 [US2] Extend `createManualBlockAction()` and `updateBlockAction()` with allocation fields in `web/src/actions/time-blocks.ts`
- [X] T028 [US2] Display allocation target (project/habit/task name) on block rows in `web/src/components/today-client.tsx`

**Checkpoint**: US2 independently testable via quickstart §4.

---

## Phase 5: User Story 3 — Countdown timer consistent on every device (Priority: P1)

**Goal**: Focus countdown stored server-side on running block; all devices count down identically.

**Independent Test**: Start 25-min focus on device A → device B shows matching countdown (quickstart §3).

### Implementation for User Story 3

- [X] T029 [US3] Accept optional `focusTargetMinutes` in `startBlockAction()` and persist on new block in `web/src/actions/time-blocks.ts`
- [X] T030 [US3] Include `focusTargetMinutes` on running block in `getTodayData()` / `TodayBlockRow` in `web/src/actions/time-blocks.ts`
- [X] T031 [US3] Update `RunningBlockPrimaryClock` in `web/src/components/today-client.tsx` to prefer server `focusTargetMinutes` over `readFocusSession()`
- [X] T032 [US3] Pass server focus target into clock in `web/src/components/focus-mode-view.tsx`
- [X] T033 [US3] Limit `writeFocusSession()` to optimistic-start window only; clear localStorage after server block id reconcile in `web/src/components/today-client.tsx`
- [X] T034 [US3] Add deprecation comment to `web/src/lib/focus-session-storage.ts` noting server field is authoritative

**Checkpoint**: US3 independently testable via quickstart §3.

---

## Phase 6: User Story 4 — Earn bonus credits for allocated time (Priority: P2)

**Goal**: 2×/2×/3× allocation bonuses visible in stats; habit auto-complete when block allocated to habit.

**Independent Test**: 1 h Deep Work + project → ~45 base credits before day-close mult; habit completes on stop (quickstart §5–6).

### Implementation for User Story 4

- [X] T035 [US4] On `stopBlockAction()` with `habitId`, call habit auto-complete (`addHabitCountForToday` / `completeHabitTodayAction`) in `web/src/actions/time-blocks.ts`
- [X] T036 [US4] Invalidate `["today"]`, `["habits"]`, `["week"]`, and `["stats"]` after habit auto-complete in stop flow via `web/src/components/today-client.tsx` or shared mutation helper
- [X] T037 [P] [US4] Show per-block or daily allocation bonus breakdown in `web/src/components/stats-client.tsx`
- [X] T038 [US4] Ensure end-day credit preview reflects allocation multipliers in `web/src/actions/end-day.ts` / `web/src/lib/day-compute.ts` (no double-count)
- [X] T039 [US4] Add inline credit hint on stopped block row when allocation bonus applied in `web/src/components/today-client.tsx`

**Checkpoint**: US4 independently testable via quickstart §5–6.

---

## Phase 7: User Story 5 — Simplified activity categories (Priority: P2)

**Goal**: Only four active categories in pickers; archived categories remain for history and settings edit.

**Independent Test**: New timer shows four categories only; legacy blocks still display (quickstart §7).

### Implementation for User Story 5

- [X] T040 [US5] Filter `getTodayData()` categories to `archived = false` only in `web/src/actions/time-blocks.ts`
- [X] T041 [US5] Apply same filter in stop/manual/edit category pickers in `web/src/components/today-client.tsx`
- [X] T042 [US5] Verify archived categories remain visible and editable in `web/src/components/categories-client.tsx`
- [X] T043 [US5] Align default schedule goals with four categories in `web/src/lib/ensure-schedule-goals.ts` and `web/src/lib/default-schedule-goals.ts`

**Checkpoint**: US5 independently testable via quickstart §7.

---

## Phase 8: User Story 6 — Complete tasks from the home page (Priority: P2)

**Goal**: Done button on Today pinned top-3 with same behavior as Tasks page.

**Independent Test**: Complete task from home → persists on Tasks page with score toast (quickstart §8).

### Implementation for User Story 6

- [X] T044 [US6] Add Done/complete control per task in `web/src/components/today-pinned-top3.tsx`
- [X] T045 [US6] Wire `useCompleteTaskMutation` from `web/src/lib/mutations/use-task-mutations.ts` in `web/src/components/today-pinned-top3.tsx`
- [X] T046 [US6] Invalidate `queryKeys.tasks` and `queryKeys.today` on home complete in `web/src/components/today-pinned-top3.tsx`

**Checkpoint**: US6 independently testable via quickstart §8.

---

## Phase 9: User Story 7 — Spend earned points in a shop (Priority: P3)

**Goal**: Symbolic shop at `/shop` with Food Coupon (850) and PS5 (16,500); atomic redemption.

**Independent Test**: Redeem food coupon → balance −850, history entry (quickstart §10–12).

### Implementation for User Story 7

- [X] T047 [P] [US7] Implement `getShopPageData()` and `redeemShopItemAction()` in `web/src/actions/shop.ts` per `specs/003-rewards-sync-shop/contracts/shop-redemptions.md`
- [X] T048 [P] [US7] Create `useShopQuery` hook in `web/src/lib/queries/shop.ts`
- [X] T049 [US7] Build `ShopClient` UI (balance, catalog, redeem, history) in `web/src/components/shop-client.tsx`
- [X] T050 [US7] Add `/shop` page with SSR initialData in `web/src/app/(app)/shop/page.tsx`
- [X] T051 [US7] Add `loading.tsx` shell at `web/src/app/(app)/shop/loading.tsx`
- [X] T052 [US7] Add Shop link to main nav in `web/src/components/app-nav.tsx`
- [X] T053 [US7] Wire stats page balance display to `computeCreditBalance()` in `web/src/components/stats-client.tsx` and `web/src/actions/stats.ts`
- [X] T054 [US7] Invalidate `queryKeys.shop` and stats queries after successful redeem in `web/src/components/shop-client.tsx`

**Checkpoint**: US7 independently testable via quickstart §10–12.

---

## Phase 10: User Story 8 — Clearer intent field when tracking time (Priority: P3)

**Goal**: Replace "Label" copy with one-line intent prompt on start/stop flows.

**Independent Test**: Field reads "what you will be doing" not "Label" (quickstart §9).

### Implementation for User Story 8

- [X] T055 [P] [US8] Update stop/manual/edit field label and placeholder to intent copy in `web/src/components/today-client.tsx`
- [X] T056 [P] [US8] Update start-timer / focus intent field copy in `web/src/components/today-client.tsx`
- [X] T057 [US8] Align intent display strings in `web/src/components/focus-mode-view.tsx` and `web/src/components/body-doubling-banner.tsx`

**Checkpoint**: US8 independently testable via quickstart §9.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and full feature validation.

- [X] T058 Run `cd web && npm run typecheck && npm run lint` and fix any errors in touched files
- [X] T059 Execute manual scenarios in `specs/003-rewards-sync-shop/quickstart.md` (all 12 sections)
- [X] T060 [P] Audit touched components for forbidden `router.refresh()` — run `rg 'router\.refresh' web/src/components/` and remove any new usages
- [X] T061 [P] Verify multi-device sync: two browsers, AM dismiss + day close + shop balance per quickstart §1–2 and §12

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Stories (Phases 3–10)**: All depend on Foundational completion
  - **US1, US2, US3** (P1): Can proceed in parallel after Phase 2 if staffed; US2/US3 touch `time-blocks.ts` — coordinate merges
  - **US4** (P2): Depends on US2 (`stopBlockAction` allocation) for habit auto-complete
  - **US5** (P2): Mostly independent after Phase 2 (category migration in foundation)
  - **US6** (P2): Independent after Phase 2
  - **US7** (P3): Depends on Phase 2 shop schema + `credit-balance.ts`
  - **US8** (P3): Independent; low conflict with other stories
- **Polish (Phase 11)**: Depends on all desired user stories

### User Story Dependencies

| Story | Depends on | Notes |
|-------|------------|-------|
| US1 | Phase 2 | Uses `queryKeys.amRundown` from T013 |
| US2 | Phase 2 | Uses `habitId` column from T003 |
| US3 | Phase 2 | Uses `focusTargetMinutes` from T003 |
| US4 | US2 + Phase 2 | Habit auto-complete on stop requires allocation FKs |
| US5 | Phase 2 | Category migration in T011–T012 |
| US6 | Phase 2 | Reuses existing task mutations |
| US7 | Phase 2 | Shop tables from T004–T006 |
| US8 | None (after Phase 2) | Copy-only changes |

### Parallel Opportunities

- **Phase 2**: T007, T008, T013 in parallel after T003–T005
- **US1**: T014 parallel with other US1 prep
- **US2**: T020 parallel before wiring tasks
- **US4**: T037 parallel with T035–T036
- **US7**: T047, T048 parallel; T051 parallel with T049
- **US8**: T055, T056 parallel
- **Polish**: T060, T061 parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, start hook + page wiring together:
Task T014: Create useAmRundownQuery in web/src/lib/queries/am-rundown.ts
Task T015: Wire initialData in web/src/app/(app)/today/page.tsx

# Then sequential modal refactor:
Task T016 → T017 → T018 → T019
```

---

## Parallel Example: User Story 7

```bash
# Backend + query hook in parallel:
Task T047: shop.ts server actions
Task T048: useShopQuery hook

# Then UI + page:
Task T049 → T050 → T052 → T054
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T013)
3. Complete Phase 3: User Story 1 (T014–T019)
4. **STOP and VALIDATE**: quickstart §1–2 (multi-device sync)
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → schema and credit math ready
2. US1 → multi-device AM/day-close sync (MVP)
3. US2 + US3 → allocation + countdown (core tracking fixes)
4. US4 + US5 + US6 → bonuses, categories, home complete
5. US7 + US8 → shop + intent copy polish
6. Polish → full quickstart pass

### Suggested MVP Scope

**Phase 1 + Phase 2 + Phase 3 (US1)** = **19 tasks** (T001–T019)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same batch
- [Story] label maps task to user story for traceability
- Server actions may keep `revalidatePath`; clients must use React Query invalidation (feature 002 pattern)
- No automated tests — manual quickstart is the acceptance gate
- Commit after each task or logical group

---

## Task Summary

| Phase | Tasks | Story | Count |
|-------|-------|-------|-------|
| Setup | T001–T002 | — | 2 |
| Foundational | T003–T013 | — | 11 |
| US1 Sync AM/day-close | T014–T019 | US1 | 6 |
| US2 Allocation dropdowns | T020–T028 | US2 | 9 |
| US3 Focus countdown sync | T029–T034 | US3 | 6 |
| US4 Credit bonuses | T035–T039 | US4 | 5 |
| US5 Categories | T040–T043 | US5 | 4 |
| US6 Home task complete | T044–T046 | US6 | 3 |
| US7 Shop | T047–T054 | US7 | 8 |
| US8 Intent field copy | T055–T057 | US8 | 3 |
| Polish | T058–T061 | — | 4 |
| **Total** | **T001–T061** | | **61** |

**Format validation**: All 61 tasks use `- [X] [TaskID] [P?] [Story?] Description with file path` checklist format.
