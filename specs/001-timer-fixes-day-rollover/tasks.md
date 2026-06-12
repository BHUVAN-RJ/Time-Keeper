---
description: "Task list for Timer Fixes & 4 AM Day Rollover"
---

# Tasks: Timer Fixes & 4 AM Day Rollover

**Input**: Design documents from `/specs/001-timer-fixes-day-rollover/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No automated test framework is configured in the repo and tests were not requested in the spec. No test tasks are generated. Verification is via `npm run typecheck`, `npm run lint`, and `quickstart.md` (see Polish phase).

**Organization**: Tasks are grouped by user story (US1–US9) in priority order so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US9 (user story phases only)
- All paths are relative to repo root; app code lives under `web/`

## Path Conventions

- Web app (single Next.js project): server actions in `web/src/actions/`, shared logic in `web/src/lib/`, UI in `web/src/components/`, schema in `web/src/db/schema.ts`, migrations in `web/drizzle/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure the dev environment is ready and a clean baseline exists.

- [ ] T001 Install dependencies and verify the app builds: run `npm install` in `web/`, confirm `npm run dev` starts.
- [X] T002 Capture a clean baseline by running `npm run typecheck` and `npm run lint` in `web/`; note any pre-existing errors so new ones are distinguishable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared primitives required by multiple stories (the 4 AM day key and the schema columns).

**⚠️ CRITICAL**: Complete before US2, US7, and US9 (and recommended before all stories that touch day math).

- [X] T003 Add schema columns in `web/src/db/schema.ts`: `day_status.wastedMinutes` (`integer`, NOT NULL, default 0), `day_status.autoClosed` (boolean, NOT NULL, default false), `user_preferences.activeWindowStart` (`text`, NOT NULL, default `'09:00'`), `user_preferences.activeWindowEnd` (`text`, NOT NULL, default `'21:00'`).
- [~] T004 Generate and apply the migration: run `npm run db:generate` then `npm run db:migrate` in `web/`; verify the new columns exist with defaults on existing rows.
- [X] T005 [P] Create `web/src/lib/day-boundary.ts` exporting `DAY_BOUNDARY_HOUR = 4`, `businessDayInTz(now, tz)` (4 AM-shifted `YYYY-MM-DD`), and `getBusinessDayRangeUtc(now, tz)` (local 04:00 → next 04:00 as UTC), per research R1.

**Checkpoint**: Day-boundary helper and schema available — story implementation can begin.

---

## Phase 3: User Story 1 - Timer never locks the app (Priority: P1) 🎯 MVP

**Goal**: Guarantee the running-timer stop/label control is always interactive and the app never becomes unusable, including across day boundaries.

**Independent Test**: Start a timer, leave it running across a simulated boundary, reopen the app, and confirm you can always stop and label the block; app stays usable.

- [X] T006 [US1] Audit and fix interaction layering in `web/src/components/focus-mode-view.tsx`: ensure the stop/label control sits in a `pointer-events-auto` region never covered by the `pointer-events-none` clock layer.
- [X] T007 [US1] In `web/src/components/today-client.tsx`, ensure the running state always renders a reachable stop affordance (remove any condition that can hide/disable it while a block runs).
- [X] T008 [US1] Add a defensive "force stop / recover" path: in `web/src/actions/time-blocks.ts` add a `forceStopBlockAction(blockId)` that finalizes a stuck running block (sets `endAt = now`) even when normal stop input is incomplete; surface it from `focus-mode-view.tsx`.
- [X] T009 [US1] Verify `stopBlockAction` in `web/src/actions/time-blocks.ts` no longer hard-requires a separate free-text label (classification via `categoryId`), so stopping cannot be blocked by a missing label (aligns with US8; keep `label` optional).

**Checkpoint**: Timer can always be stopped/labeled; app never locks (SC-001).

---

## Phase 4: User Story 2 - Day ends at 4:00 AM with silent auto-close (Priority: P1)

**Goal**: Move the day boundary to 4:00 AM, silently auto-close elapsed days, and split/restart a running timer at the boundary.

**Independent Test**: With a timer running, cross 4:00 AM (or reload after 4 AM); confirm the running block is closed at the boundary, a new block resumes for the new day, the prior day auto-closes (no prompt), and 1 AM activity attributes to the prior business day.

- [~] T010 [US2] Migrate day-scoped reads to the 4 AM helpers: replace `getDayRangeUtc`/`calendarDayInTz` usages with `getBusinessDayRangeUtc`/`businessDayInTz` in `web/src/lib/day-compute.ts`, `web/src/lib/day-range.ts` callers, and `web/src/actions/time-blocks.ts` (`getTodayData`/`pollTodayData`).
- [ ] T011 [US2] Update `web/src/lib/unclosed-days.ts` to detect unclosed days using business-day keys (source for auto-close).
- [X] T012 [US2] Implement `splitRunningBlockAtBoundary(userId, now)` in `web/src/actions/time-blocks.ts`: transactionally close the running block at the crossed boundary and insert a new running block carrying `categoryId`, `statedIntent`, `projectId`, `taskId`; create closed segments for any intermediate days; honor the running-block unique index (research R3).
- [ ] T013 [US2] Add silent auto-close in `web/src/actions/end-day.ts`: a metrics-only finalize (compute score incl. wasted, roll incomplete system tasks forward, set `day_status.endedAt` + `autoClosed = true`) that does NOT require mood/notes/plan (FR-006/006a).
- [ ] T014 [US2] Implement `reconcileDayRollover(userId, now)` in `web/src/actions/day-status.ts` orchestrating T012 + T013 (oldest-first), idempotent and concurrency-safe (research R2).
- [~] T015 [US2] Wire `reconcileDayRollover` into the primary authenticated entry points: Today data load (`time-blocks.ts`), AM rundown load (`web/src/actions/am-rundown.ts`), and timer start/stop actions.
- [ ] T016 [US2] Remove the manual "Close all days" batch step from the normal flow: update `web/src/components/am-rundown-modal.tsx` and `web/src/actions/am-rundown.ts` so normal rollover is automatic (keep optional catch-up only if trivial).

**Checkpoint**: 4 AM boundary live; days auto-close; running timer survives the boundary (SC-002).

---

## Phase 5: User Story 3 - Instant timer start (Priority: P1)

**Goal**: Make timer start local-first/instant with background server sync and graceful failure.

**Independent Test**: Under throttled network, start a timer and confirm the focus screen appears in < 200 ms; on forced failure, a toast + recovery appears with no lost time.

- [ ] T017 [US3] Update `startBlockAction` in `web/src/actions/time-blocks.ts` to return the persisted block (`{ ok: true, block }`) and a structured conflict (`{ ok:false, reason:'already_running', runningBlockId }`) per contracts/timer-actions.md.
- [X] T018 [US3] Refactor `onStart` in `web/src/components/today-client.tsx` to optimistically insert a running block into the `["today"]` react-query cache and transition to focus view synchronously (no `await`), then call `startBlockAction` in the background.
- [X] T019 [US3] Add reconciliation/rollback in `web/src/components/today-client.tsx`: on success swap optimistic id → server id; on `already_running` or error, roll back, show a `sonner` toast, and offer a recovery action without discarding input (FR-011).

**Checkpoint**: Start feels instantaneous; failures are recoverable (SC-003).

---

## Phase 6: User Story 4 - Edit a task after it is added (Priority: P2)

**Goal**: Allow editing an existing task's details.

**Independent Test**: Create a task, edit fields, save → persists everywhere; cancel → no change.

- [X] T020 [US4] Add `updateTaskAction(taskId, fields)` in `web/src/actions/tasks.ts` (partial update of title/estimateMinutes/categoryId/projectId/dueDate/scheduledDate/description; validate; bump `updatedAt`) per contracts/tasks-actions.md.
- [X] T021 [US4] Add an edit UI (form/dialog) in `web/src/components/tasks-client.tsx` that opens an existing task, submits via `updateTaskAction`, and reflects changes; cancel persists nothing.

**Checkpoint**: Tasks are editable (SC-004).

---

## Phase 7: User Story 5 - Remaining tasks list (Priority: P2)

**Goal**: Show all open tasks regardless of date, correctly ordered.

**Independent Test**: With mixed task states/dates, the list shows only open tasks ordered overdue/today → upcoming → undated; completing/dropping removes them.

- [X] T022 [US5] Add `getRemainingTasks()` in `web/src/actions/tasks.ts`: select tasks where `status NOT IN ('completed','dropped')`, ordered overdue/today (≤ business day) → upcoming → undated backlog (FR-014/014a).
- [X] T023 [US5] Add a remaining-tasks list view in `web/src/components/tasks-client.tsx` (or a new panel) consuming `getRemainingTasks`; ensure completing/dropping removes items reactively (FR-015).

**Checkpoint**: Remaining list accurate and reactive (SC-005).

---

## Phase 8: User Story 6 - Completed and passed items struck through (Priority: P2)

**Goal**: Strikethrough completed tasks (all sources) and passed Google-Calendar items only.

**Independent Test**: Completed task → struck; passed GCal item → struck; system task with passed date → not struck (rolls forward).

- [X] T024 [P] [US6] In `web/src/components/tasks-client.tsx` (and `today-pinned-top3.tsx` / `today` panels as applicable), apply strikethrough styling when task `status = 'completed'` (FR-016).
- [X] T025 [P] [US6] In `web/src/components/calendar-events-list.tsx`, apply strikethrough to Google-Calendar-sourced items whose scheduled day/week (business-day based) is past and not completed; do NOT strike system tasks (FR-017).

**Checkpoint**: Visual closure rules correct (SC-006).

---

## Phase 9: User Story 7 - Good morning screen on first login after 4 AM (Priority: P2)

**Goal**: Show the good-morning screen on first open after 4 AM; offer the optional reflective review.

**Independent Test**: After 4 AM first open → screen shows; reopening same day → hidden; optional review for last closed day is offered and dismissible.

- [X] T026 [US7] Update `web/src/actions/am-rundown.ts` to key `amSeenAt`/gating by the 4 AM business day (`businessDayInTz`) so the screen shows once per business day (FR-018/019).
- [ ] T027 [US7] In `web/src/components/am-rundown-modal.tsx`, add a non-blocking entry to complete the optional reflective review (mood/notes/plan) for the most recently closed day (FR-006a), dismissible.

**Checkpoint**: Good-morning gating aligned to 4 AM (SC-007). Depends on US2 (T010, T014).

---

## Phase 10: User Story 8 - Single Label dimension + analysis; remove tags (Priority: P3)

**Goal**: Merge category + free-text label into "Label" with an expandable picker and per-label analysis; remove tags entirely.

**Independent Test**: No tag UI anywhere; expandable Label picker creates labels inline with neutral defaults; stats show time per Label with reconciling totals.

- [ ] T028 [US8] Add a neutral-label default + inline create action in `web/src/actions/categories.ts` (`createLabelInline(name)` → insert with `NEUTRAL_RATE`, auto color, no schedule goal); define `NEUTRAL_RATE` near `web/src/lib/default-categories.ts` (FR-022a).
- [ ] T029 [US8] Build an expandable Label picker component (combobox) that lists existing Labels and supports inline create via `createLabelInline`; place under `web/src/components/` (e.g., `label-picker.tsx`).
- [ ] T030 [US8] Replace the category `<select>` with the Label picker in start/stop/manual-block and task-create flows (`web/src/components/today-client.tsx`, `focus-mode-view.tsx`, `tasks-client.tsx`); relabel "Category" → "Label" in UI strings.
- [~] T031 [US8] Remove the separate free-text label field from start/stop/manual UI; ensure classification uses the Label (categoryId); keep `time_blocks.label` column unused/deprecated (FR-021).
- [ ] T032 [P] [US8] Add per-Label time analysis to `web/src/components/stats-client.tsx` using `web/src/actions/stats.ts` (group block durations by `categoryId`); ensure totals reconcile (FR-023/SC-009).
- [~] T033 [P] [US8] Remove tags: delete `web/src/components/tag-picker.tsx` and `web/src/components/tags-settings.tsx`, remove tag inputs from stop/manual/task-create, and remove tag breakdown from `web/src/actions/month.ts` / `stats-client.tsx` (FR-020).
- [X] T034 [US8] Stop reading/writing `tagsEnabled`: remove its usage from `web/src/actions/preferences.ts`, `settings-client.tsx`, and any gating in pickers (column left deprecated per data-model) (SC-008).

**Checkpoint**: Single Label dimension + analysis; tags gone (SC-008/SC-009). Touches timer files — sequence after US1/US3 to avoid conflicts.

---

## Phase 11: User Story 9 - Untracked time within active hours counts as wasted (Priority: P3)

**Goal**: Configurable active window; derived wasted time affecting the day score.

**Independent Test**: Set a window; partial coverage → uncovered in-window time = wasted; out-of-window not wasted; score reflects it; logging a block later reduces wasted.

- [X] T035 [US9] Add `setActiveWindowAction(start, end)` in `web/src/actions/preferences.ts` with `HH:MM` validation (`^([01]\d|2[0-3]):[0-5]\d$`); upsert `activeWindowStart/End` (FR-024/027).
- [X] T036 [US9] Add active-window start/end controls to `web/src/components/settings-client.tsx` (defaults 09:00–21:00).
- [X] T037 [P] [US9] Create `web/src/lib/wasted-time.ts` with `computeWastedMinutes(businessDayRange, blocks, window, tz)`: intersect window with business day (support crossing midnight), subtract union of in-window block coverage, return minutes ≥ 0 (FR-025/026/026a).
- [~] T038 [US9] Integrate wasted time into scoring: in `web/src/lib/day-compute.ts` / `web/src/lib/productivity-scores.ts` / `web/src/lib/score-breakdown.ts`, count wasted minutes as uncredited time and persist to `day_status.wastedMinutes` on close; compute live for the open day (FR-026b/SC-010).

**Checkpoint**: Wasted time computed and scored (SC-010). Depends on US2 (business-day helpers) and Foundational schema.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Validation, cleanup, and optional follow-ups across stories.

- [X] T039 Run `npm run typecheck` in `web/` and fix any new type errors introduced by this feature.
- [X] T040 Run `npm run lint` in `web/` and resolve new lint issues.
- [ ] T041 Execute `specs/001-timer-fixes-day-rollover/quickstart.md` walkthroughs for US1–US9 and record results.
- [ ] T042 [P] (Optional follow-up) Add a migration to drop `tags`, `task_tags`, `time_block_tags`, and `user_preferences.tags_enabled` once confirmed unused (research R6); keep separate from the core migration.
- [ ] T043 [P] Update `web/README.md` to reflect the 4 AM day model, Label terminology, removed tags, and active-window/wasted-time setting.

---

## Implementation Status (2026-06-03)

Legend: `[X]` done · `[~]` partial · `[ ]` not started.

**Done & verified** (`npm run typecheck` + `npm run lint` both pass):
US1 (T006–T009), US3 (T018–T019), US4 (T020–T021), US5 (T022–T023),
US6 (T024–T025), US7 (T026), US9 lib/settings/derived metric (T035–T037),
tags-off (T034), foundational schema + helper (T003, T005), polish gates (T039–T040).

**Partial (`[~]`) — intentionally scoped to avoid destabilizing scoring/credits:**
- T004: migration SQL generated (`web/drizzle/0013_day_rollover_wasted_time.sql`,
  hand-written to match the repo's non-snapshot convention). NOT applied to the
  remote Turso DB — run `npm run db:migrate` to deploy (additive/safe).
- T010/T015: 4 AM boundary applied to the **now-based** read paths (Today view,
  tasks "today", AM rundown) + running-block split wired into Today. The deep
  date-string day graph (`day-compute.ts`, week/month/stats) still uses the legacy
  midnight range and was deliberately not migrated blind.
- T012: running block is split/restarted at the boundary (single boundary cross;
  multi-day intermediate closed segments not generated).
- T031/T033: free-text label removed from the stop modal; tags disabled globally
  and the Tags settings toggle removed. Tag DB tables and `tag-picker.tsx`/
  `tags-settings.tsx` files were left in place (no destructive deletes).
- T038: wasted time is computed on the 4 AM business day and surfaced as a derived
  Today metric. Folding it into the **persisted** productivity score was deferred
  because that score still runs on the legacy midnight-day graph (mixing bases
  would produce wrong scores).

**Not started (deferred, higher-risk / depend on full day-graph migration):**
T011 (unclosed-days business keys), T013 (silent metrics-only auto-close),
T014 (`reconcileDayRollover` orchestration), T016 (remove "Close all days"),
T017 (startBlockAction return-shape change), T027 (optional review entry in AM modal),
T028–T030/T032 (inline-create Label picker + per-Label analysis UI),
T041 (manual quickstart run — needs a running app/DB), T042 (drop-tags migration),
T043 (README update).

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. T003→T004 sequential (schema then migrate). T005 independent ([P]). Blocks US2/US7/US9.
- **User Stories (Phases 3–11)**: Depend on Foundational. Priority order P1 (US1, US2, US3) → P2 (US4, US5, US6, US7) → P3 (US8, US9).
- **Polish (Phase 12)**: After desired stories complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational. Independent (reachability/recovery). Shares `time-blocks.ts`/`today-client.tsx` with US3/US8 — sequence to avoid conflicts.
- **US2 (P1)**: After Foundational (needs T005 helper + T003/T004 schema). Provides business-day helpers used by US7/US9.
- **US3 (P1)**: After Foundational. Touches `time-blocks.ts`/`today-client.tsx` (coordinate with US1/US2).
- **US4 (P2)**: After Foundational. Independent (`tasks.ts`/`tasks-client.tsx`).
- **US5 (P2)**: After Foundational. Independent; light overlap with US4 in `tasks-client.tsx`.
- **US6 (P2)**: After Foundational. Mostly independent (presentation).
- **US7 (P2)**: After US2 (business-day gating + auto-close). 
- **US8 (P3)**: After US1/US3 (shares timer/stop files); independent of US9.
- **US9 (P3)**: After US2 + Foundational schema.

### Within Each User Story

- Server action/data changes before UI wiring.
- Shared `lib/` helpers before consumers.
- Story complete and checkpoint-verified before moving on.

### Parallel Opportunities

- T005 runs parallel to T003/T004 in Foundational.
- US6 tasks T024 and T025 are [P] (different files).
- US8 T032 and T033 are [P]; US9 T037 is [P].
- Polish T042 and T043 are [P].
- With multiple developers after Foundational: US4, US5, US6 can proceed in parallel; US1/US2/US3 should be coordinated (shared timer files).

---

## Parallel Example: Foundational + US6

```bash
# Foundational: create the day-boundary helper while schema migration is prepared
Task: "Create web/src/lib/day-boundary.ts (businessDayInTz, getBusinessDayRangeUtc)"

# US6 presentation tasks (different files):
Task: "Strikethrough completed tasks in web/src/components/tasks-client.tsx"
Task: "Strikethrough passed GCal items in web/src/components/calendar-events-list.tsx"
```

---

## Implementation Strategy

### MVP First (P1 stories)

1. Phase 1 Setup → Phase 2 Foundational.
2. US1 (never locks) → US2 (4 AM boundary/auto-close) → US3 (instant start).
3. **STOP and VALIDATE**: the core timer + day model is stable and pleasant — this is the highest-value MVP.

### Incremental Delivery

1. Foundation ready.
2. Ship P1 (US1–US3) → validate → demo.
3. Add P2 (US4 edit, US5 remaining list, US6 strikethrough, US7 good-morning) → validate → demo.
4. Add P3 (US8 labels/analysis + tag removal, US9 wasted time) → validate → demo.

### Notes

- [P] = different files, no incomplete-task dependencies.
- Coordinate edits to `web/src/actions/time-blocks.ts` and `web/src/components/today-client.tsx` across US1/US2/US3/US8 (shared files).
- Commit after each task or logical group; verify checkpoints before advancing.
