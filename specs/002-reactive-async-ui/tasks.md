---
description: "Task list for Reactive UI & Async Data Sync"
---

# Tasks: Reactive UI & Async Data Sync

**Input**: Design documents from `/specs/002-reactive-async-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No automated test framework is configured and tests were not requested in the spec. No test tasks are generated. Verification is via `npm run typecheck`, `npm run lint`, and `quickstart.md` (see Polish phase).

**Organization**: Tasks are grouped by user story (US1–US5) in priority order so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 (user story phases only)
- All paths are relative to repo root; app code lives under `web/`

## Path Conventions

- Web app (single Next.js project): server actions in `web/src/actions/`, shared logic in `web/src/lib/`, UI in `web/src/components/`, pages in `web/src/app/(app)/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure the dev environment is ready and a clean baseline exists.

- [X] T001 Install dependencies and verify the app builds: run `npm install` in `web/`, confirm `npm run dev` starts.
- [X] T002 Capture a clean baseline by running `npm run typecheck` and `npm run lint` in `web/`; note any pre-existing errors so new ones are distinguishable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared query-key factory, optimistic mutation helper, and server-action return contracts required by all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Create centralized query key factory in `web/src/lib/queries/keys.ts` per `data-model.md` (today, tasks, habits, projects, categories, week, stats).
- [X] T004 [P] Implement `createOptimisticMutation` helper in `web/src/lib/mutations/optimistic.ts` per `contracts/optimistic-mutations.md` (onMutate snapshot, onError rollback, onSettled invalidate).
- [X] T005 Configure `QueryClient` default options in `web/src/components/providers.tsx` (`staleTime: 30_000`, `retry: 1`, `mutations.retry: 0`) per `contracts/navigation-loading.md`.
- [X] T006 [P] Create `web/src/lib/queries/tasks.ts` exporting `fetchTasksPageData` wrapper around `getTasksPageData` and typed `TasksPageData` re-export.
- [X] T007 [P] Create task cache helpers in `web/src/lib/queries/task-cache-helpers.ts`: `insertOptimisticTask`, `updateTaskInCache`, `moveTaskBetweenLists`, `replaceTempId` per `data-model.md` state transitions.
- [X] T008 [P] Add `web/src/lib/temp-id.ts` exporting `createTempId()` (`temp_${crypto.randomUUID()}`) and `isTempId(id)` per research R3.
- [X] T009 Extend `createTaskAction` in `web/src/actions/tasks.ts` to `.returning({ id: tasks.id })` and return `{ id: string }` per `contracts/optimistic-mutations.md`.
- [X] T010 [P] Extend `createHabitAction` in `web/src/actions/habits.ts` and `createProjectAction` in `web/src/actions/projects.ts` to return `{ id: string }` per `contracts/optimistic-mutations.md`.

**Checkpoint**: Foundation ready — optimistic mutations and query infrastructure available for all stories.

---

## Phase 3: User Story 1 - Instant Task Mutations (Priority: P1) 🎯 MVP

**Goal**: Task create, complete, edit, schedule, and drop update the visible list immediately; form clears on create; background sync reconciles or rolls back on failure.

**Independent Test**: On `/tasks` with network throttled, create a task — card appears in < 100 ms, form clears, no full-page reload; on failure, rollback + toast.

### Implementation for User Story 1

- [X] T011 [US1] Slim `web/src/app/(app)/tasks/page.tsx` to fetch `getTasksPageData()` once and pass as `initialData` prop to `TasksHubClient` / `TasksClient` (no blocking refresh dependency).
- [X] T012 [US1] Refactor `web/src/components/tasks-client.tsx` to `useQuery({ queryKey: queryKeys.tasks.all, queryFn: fetchTasksPageData, initialData })` replacing static `initial` prop reads.
- [X] T013 [P] [US1] Create `web/src/lib/mutations/use-task-mutations.ts` with `useCreateTaskMutation` (optimistic insert into correct lists, form clear on mutate, temp id reconcile) per `contracts/tasks-cache.md`.
- [X] T014 [P] [US1] Add `useCompleteTaskMutation`, `useDropTaskMutation`, `useScheduleForTodayMutation`, and `useUpdateTaskMutation` in `web/src/lib/mutations/use-task-mutations.ts` per `contracts/tasks-cache.md`.
- [X] T015 [US1] Refactor `TaskCard` in `web/src/components/tasks-client.tsx`: remove global `busy`/`run()` wrapper; use per-mutation `isPending` on individual buttons; apply strikethrough from optimistic `status` immediately (FR-011).
- [X] T016 [US1] Wire create-task form in `web/src/components/tasks-client.tsx` to `useCreateTaskMutation`; remove `pending` state that blocks the entire form after optimistic insert.
- [X] T017 [US1] Remove `router.refresh()` from `web/src/components/tasks-client.tsx`; replace `EisenhowerBoard` `onSaved` with `queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })` in `web/src/components/eisenhower-board.tsx` or via callback prop.
- [X] T018 [US1] On task mutations affecting today's schedule, fire-and-forget `queryClient.invalidateQueries({ queryKey: queryKeys.today.all })` per `data-model.md` invalidation rules.

**Checkpoint**: All task CRUD feels instant; no `router.refresh()` on Tasks page (SC-001, FR-001, FR-002).

---

## Phase 4: User Story 2 - Instant In-Page Tab Switching (Priority: P1)

**Goal**: Tasks sub-tabs and Tasks hub views (Tasks / Habits / Projects) switch UI state synchronously; data from cache or lazy fetch with inline skeleton.

**Independent Test**: Rapidly switch Today → Backlog → Matrix — tab highlight changes in < 50 ms, no full-page spinner; hub Habits view mounts instantly.

### Implementation for User Story 2

- [X] T019 [US2] Refactor `web/src/components/tasks-hub-client.tsx` to set local `view` state synchronously on tab click; use `router.replace(pathname + query, { scroll: false })` for URL sync without awaiting RSC per `contracts/tasks-cache.md`.
- [X] T020 [P] [US2] Create `web/src/lib/queries/habits.ts` with `fetchHabitsManage` wrapper around `listHabitsForManage` and `queryKeys.habits.manage`.
- [X] T021 [US2] Refactor `web/src/components/habits-client.tsx` to accept optional `initialData` and use `useQuery` with `enabled` when hub view is `habits`; show inline skeleton only inside panel on first fetch.
- [X] T022 [US2] Update `web/src/components/tasks-hub-client.tsx` to lazy-mount Habits/Projects panels: keep Tasks panel data from parent cache; fetch habits on first `habits` view open if cache miss.
- [X] T023 [US2] Ensure `TaskTabs` in `web/src/components/tasks-client.tsx` uses synchronous `setTab` only; derive tab lists via `useMemo` from `["tasks"]` cache; add subtle `isFetching` indicator in tab bar during background refetch (FR-003, FR-004).

**Checkpoint**: Tab and hub view switches are instant; stale-while-revalidate works (SC-002).

---

## Phase 5: User Story 3 - Instant Route Navigation (Priority: P2)

**Goal**: Main route navigations show page shells immediately via `loading.tsx`; Today re-tap refreshes data in background without full RSC reload.

**Independent Test**: Navigate Today → Stats — shell appears before data; tap Today while on Today — no white flash, data refetches in background.

### Implementation for User Story 3

- [X] T024 [P] [US3] Add `web/src/app/(app)/tasks/loading.tsx` using `PageLoadingShell` with `title="Tasks"`.
- [X] T025 [P] [US3] Add `web/src/app/(app)/stats/loading.tsx` using `PageLoadingShell` with `title="Stats"`.
- [X] T026 [P] [US3] Add `web/src/app/(app)/week/loading.tsx` using `PageLoadingShell` with `title="Week"`.
- [X] T027 [P] [US3] Add `web/src/app/(app)/settings/loading.tsx` using `PageLoadingShell` with `title="Settings"`.
- [X] T028 [US3] Refactor `web/src/components/app-nav.tsx`: replace `router.refresh()` on Today re-tap with `queryClient.invalidateQueries({ queryKey: queryKeys.today.all })` per `contracts/navigation-loading.md`.
- [X] T029 [US3] Refactor `web/src/components/calendar-poll-provider.tsx` to invalidate calendar-related query keys instead of `router.refresh()` after `refreshGoogleCalendarCacheAction` (or document exception if RSC-only).

**Checkpoint**: Route shells paint instantly; nav refresh is non-blocking (FR-005).

---

## Phase 6: User Story 4 - Reactive Timer & Today Dashboard (Priority: P2)

**Goal**: Extend existing optimistic timer start to stop, manual blocks, delete/edit, and habit toggles on the Today page.

**Independent Test**: Stop a running timer — running UI clears in < 200 ms; completed block appears optimistically; habit checkbox toggles immediately.

### Implementation for User Story 4

- [X] T030 [P] [US4] Create `web/src/lib/mutations/today-cache-helpers.ts` with optimistic helpers for running block clear, block list insert/update/remove per `contracts/today-cache.md`.
- [X] T031 [US4] Implement optimistic `stopBlock` in `web/src/components/today-client.tsx`: clear running state and close dialog immediately; append completed block to cache; rollback on error (FR-008, SC-005).
- [X] T032 [US4] Implement optimistic `createManualBlock`, `updateBlock`, and `deleteBlock` flows in `web/src/components/today-client.tsx` per `contracts/today-cache.md`.
- [X] T033 [US4] Extend `createManualBlockAction` in `web/src/actions/time-blocks.ts` to return `{ id: string }` if not already returning block id for reconcile.
- [X] T034 [US4] Refactor `web/src/components/today-habits-panel.tsx` for optimistic habit log toggle with rollback on failure per `contracts/today-cache.md`.
- [X] T035 [US4] Replace `await qc.invalidateQueries(...)` with fire-and-forget `void qc.invalidateQueries(...)` in `web/src/components/today-client.tsx` where optimistic state is already applied.

**Checkpoint**: Today dashboard actions feel instant end-to-end (SC-005, FR-008).

---

## Phase 7: User Story 5 - Reactive Settings & Secondary Surfaces (Priority: P3)

**Goal**: Categories, projects, habits, reminders, and modals migrate off `router.refresh()` to optimistic mutations or targeted cache invalidation.

**Independent Test**: Rename a label — list updates immediately; create a project — appears in list without full page reload.

### Implementation for User Story 5

- [X] T036 [P] [US5] Create `web/src/lib/queries/categories.ts` with `fetchCategories` and `queryKeys.categories.all`.
- [X] T037 [US5] Refactor `web/src/components/categories-client.tsx` to `useQuery` + optimistic create/update mutations; remove `router.refresh()` per FR-009.
- [X] T038 [US5] Enhance `web/src/components/projects-client.tsx` with optimistic `createProject`, `updateProject`, and `completeProject` via `useMutation` + `setQueryData` instead of `await refetch()` blocking.
- [X] T039 [US5] Complete `web/src/components/habits-client.tsx` migration: optimistic create/archive/update using `use-task-mutations` pattern from T013–T014 applied to habits.
- [X] T040 [P] [US5] Refactor `web/src/components/reminders-client.tsx` to use `useQuery` + mutation invalidation instead of `router.refresh()`.
- [X] T041 [P] [US5] Refactor `web/src/components/google-calendar-settings.tsx`, `web/src/components/weekly-review-panel.tsx`, and `web/src/components/today-v02-panel.tsx` to replace `router.refresh()` with targeted `invalidateQueries` or optimistic local state.
- [X] T042 [P] [US5] Refactor `web/src/components/end-day-dialog.tsx` and `web/src/components/am-rundown-modal.tsx`: keep blocking only where server response drives branching; otherwise background invalidate of `["today"]` / `["week"]` keys.
- [X] T043 [US5] Refactor `web/src/components/reminder-chrome.tsx` to use mutation + `invalidateQueries` instead of `router.refresh()`.

**Checkpoint**: Secondary surfaces follow optimistic/sync pattern (FR-009).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Audit, validation, and quality gates across all stories.

- [X] T044 [P] Audit `router.refresh()` in `web/src/components/`: remove or document justified exceptions in `specs/002-reactive-async-ui/quickstart.md` (target SC-003: ~zero component calls).
- [X] T045 Run manual validation checklist in `specs/002-reactive-async-ui/quickstart.md` (sections 1–10).
- [X] T046 Run `npm run typecheck` in `web/` and fix any new errors introduced by this feature.
- [X] T047 Run `npm run lint` in `web/` and fix any new errors introduced by this feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**.
- **User Stories (Phases 3–7)**: All depend on Foundational completion.
  - US1 and US2 are both P1 — US2 can start after Foundational but benefits from US1 cache patterns; recommended order: US1 → US2.
  - US3 is independent of US1/US2 (loading shells + app-nav).
  - US4 depends on Foundational only (reuses optimistic helper from T004).
  - US5 depends on Foundational; benefits from mutation patterns established in US1.
- **Polish (Phase 8)**: Depends on desired user stories being complete.

### User Story Dependencies

| Story | Priority | Depends on | Independent test |
|-------|----------|------------|------------------|
| US1 | P1 | Phase 2 | Throttled task create on `/tasks` |
| US2 | P1 | Phase 2 (US1 recommended) | Rapid tab switching on Tasks |
| US3 | P2 | Phase 2 | Route nav shells + Today re-tap |
| US4 | P2 | Phase 2 | Optimistic timer stop on `/today` |
| US5 | P3 | Phase 2 (US1 patterns helpful) | Optimistic label/project edit |

### Within Each User Story

- Server action return-type changes (Phase 2) before client mutations that reconcile ids.
- Query hooks before component refactors that consume them.
- Remove `router.refresh()` only after replacement invalidation/optimistic path is wired.

### Parallel Opportunities

- **Phase 2**: T004, T006, T007, T008, T010 can run in parallel after T003.
- **US1**: T013 and T014 can run in parallel (same file — coordinate); T015–T017 sequential on `tasks-client.tsx`.
- **US3**: T024–T027 all parallel (different `loading.tsx` files).
- **US4**: T030 parallel with T033 (different files).
- **US5**: T036, T040, T041, T042, T043 parallel across different components.
- **Polish**: T044 parallel with T045 prep; T046/T047 sequential.

---

## Parallel Example: User Story 1

```bash
# After T012 lands, launch mutation hooks in parallel:
Task T013: "Create useCreateTaskMutation in web/src/lib/mutations/use-task-mutations.ts"
Task T014: "Add complete/drop/schedule/update mutations in web/src/lib/mutations/use-task-mutations.ts"

# After T011, loading shells for US3 can start in parallel with US1:
Task T024: "Add web/src/app/(app)/tasks/loading.tsx"
```

---

## Parallel Example: User Story 3

```bash
# All loading shells are independent files:
Task T024: "web/src/app/(app)/tasks/loading.tsx"
Task T025: "web/src/app/(app)/stats/loading.tsx"
Task T026: "web/src/app/(app)/week/loading.tsx"
Task T027: "web/src/app/(app)/settings/loading.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**CRITICAL**)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `quickstart.md` sections 1–2
5. Demo instant task create/complete

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. US1 → instant task mutations (MVP)
3. US2 → instant tabs (completes P1 scope)
4. US3 → route loading shells
5. US4 → Today optimistic gaps
6. US5 → secondary surfaces
7. Polish → audit + quality gates

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 + US2 (Tasks surface)
   - Developer B: US3 + US4 (navigation + Today)
   - Developer C: US5 (secondary surfaces)
3. Converge on Polish phase

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [Story] label maps task to user story for traceability
- No DB schema migrations required for this feature
- Server actions keep `revalidatePath` for SSR coherence; clients must not depend on it (FR-010)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently

---

## Task Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Setup | T001–T002 | — |
| Foundational | T003–T010 | — |
| US1 Instant Task Mutations | T011–T018 | 8 |
| US2 Instant Tab Switching | T019–T023 | 5 |
| US3 Route Navigation | T024–T029 | 6 |
| US4 Today Dashboard | T030–T035 | 6 |
| US5 Secondary Surfaces | T036–T043 | 8 |
| Polish | T044–T047 | — |
| **Total** | **47** | |

**Suggested MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1) — 18 tasks.

**Format validation**: All 47 tasks use `- [ ] [TaskID] [P?] [Story?] Description with file path` checklist format.
