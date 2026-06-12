# Data Model: Reactive UI & Async Data Sync

**Feature**: `002-reactive-async-ui` | **Date**: 2026-06-11

This feature does **not** change the Drizzle database schema. It introduces **client-side cache structures** and **mutation lifecycle states** that mirror existing server entities.

## Server entities (unchanged)

All persistence continues through existing tables: `tasks`, `time_blocks`, `habits`, `habit_logs`, `categories`, `projects`, `day_status`, etc. See `web/src/db/schema.ts` and `specs/001-timer-fixes-day-rollover/data-model.md` for authoritative schemas.

## Client cache entities

### QueryKey

Typed tuple identifying a cached slice. Centralized in `lib/queries/keys.ts`.

| Key pattern | Data shape | Source action |
|-------------|------------|---------------|
| `["today"]` | `TodayData` | `getTodayData` |
| `["today", "extras"]` | `TodayDashboardExtras` | `getTodayDashboardExtras` |
| `["tasks"]` | `TasksPageData` | `getTasksPageData` |
| `["tasks", "tab", Tab]` | Derived task list slice | select from `["tasks"]` |
| `["habits", "manage"]` | `listHabitsForManage` result | `listHabitsForManage` |
| `["projects"]` | `ProjectListRow[]` | `listProjects` |
| `["categories"]` | Category list | `listCategories` (or inline from tasks data) |
| `["week", weekKey]` | Week dashboard | `getWeekData` |
| `["stats", range]` | Stats payload | stats actions |

### TasksPageData (client cache root for tasks UI)

Mirrors `getTasksPageData()` return type:

| Field | Type | Used by tabs |
|-------|------|--------------|
| `today` | `string` (business day key) | All |
| `todayTasks` | `TaskRow[]` | Today tab |
| `remainingTasks` | `TaskRow[]` | Remaining tab |
| `backlogTasks` | `TaskRow[]` | Backlog tab |
| `matrixByQuadrant` | `Record<Quadrant, TaskRow[]>` | Matrix tab |
| `matrixLayout` | layout JSON | Matrix DnD |
| `categories` | `CategoryOption[]` | Create form, cards |
| `activeProjects` | `ProjectOption[]` | Pickers |
| `allTags` | `TagOption[]` | Tag picker (if enabled) |
| `tagsEnabled` | `boolean` | Conditional UI |
| `estimateHint` | hint object | Create form |

**Validation**: Optimistic inserts must produce valid `TaskRow` shape (minimal fields + `tempId`); server reconcile fills authoritative fields (`id`, `createdAt`, `rescheduleCount`, etc.).

### TaskRow (optimistic extension)

Existing `TaskRow` from `@/actions/tasks` plus optional client fields:

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Real UUID or `temp_${uuid}` until synced |
| `title` | yes | |
| `status` | yes | `backlog` \| `scheduled` \| `in_progress` \| `completed` \| `dropped` |
| `estimateMinutes` | yes | |
| `_optimistic?` | no | `true` while server sync pending |
| `_syncError?` | no | Set on rollback failure for debugging |

### OptimisticMutation (ephemeral, not persisted)

| Field | Type | Description |
|-------|------|-------------|
| `mutationId` | `string` | Client-generated correlation id |
| `entityType` | `"task"` \| `"block"` \| `"habit"` \| ... | |
| `entityId` | `string` | Target or temp id |
| `operation` | `"create"` \| `"update"` \| `"delete"` | |
| `previousSnapshot` | `unknown` | Query cache before mutate (for rollback) |
| `status` | `"pending"` \| `"synced"` \| `"failed"` | |

### TabViewState (UI-only)

| Field | Type | Description |
|-------|------|-------------|
| `activeTab` | `Tab` | `today` \| `remaining` \| `backlog` \| `matrix` |
| `hubView` | `TasksHubView` | `tasks` \| `habits` \| `projects` |
| `loadedTabs` | `Set<Tab>` | Tabs whose data has been fetched at least once |

Stored in component `useState` — not React Query.

## State transitions

### Task create (optimistic)

```text
[User submits form]
  → INSERT optimistic TaskRow into correct list(s) in cache (status derived from dates)
  → CLEAR form fields immediately
  → ASYNC createTaskAction → returns { id }
  → REPLACE tempId with real id; clear _optimistic
  → ON ERROR: rollback previousSnapshot; toast
```

### Task complete (optimistic)

```text
[User taps Done]
  → SET task.status = 'completed' in all cache lists containing task
  → APPLY strikethrough styling immediately
  → ASYNC completeTaskAction → may return score toast data
  → ON SUCCESS: optional toast from server response
  → ON ERROR: rollback; toast
```

### Tab switch

```text
[User clicks tab]
  → SET activeTab synchronously (UI highlight)
  → IF tab data in cache: RENDER immediately (may show stale badge)
  → IF not: SHOW inline skeleton; useQuery fetches slice
  → ON SETTLED: replace skeleton with data
```

### Timer stop (optimistic)

```text
[User confirms stop]
  → REMOVE running block from running slot in ["today"] cache
  → APPEND completed block row to blocks list optimistically
  → CLEAR focus session locally
  → ASYNC stopBlockAction
  → ON SETTLED: invalidate or merge authoritative block (quality, credits, lucky bonus)
```

## Cache invalidation rules

| Event | Invalidation scope |
|-------|-------------------|
| Task mutation | `["tasks"]`; optionally `["today"]` if task on today list |
| Timer start/stop | `["today"]` |
| Habit log toggle | `["today", "extras"]` or habits sub-key |
| Project create | `["projects"]`; `["tasks"]` if picker lists projects |
| Settings change | Targeted key only (not global refresh) |

## Invariants (must preserve)

1. **Single running block** — optimistic start must still check cache for running block before insert; server `ALREADY_RUNNING` triggers rollback (existing Today behavior).
2. **Auth scoping** — all server actions unchanged; client cannot bypass `requireUser()`.
3. **Idempotency** — complete/drop on already-completed task: server no-ops; client should guard duplicate taps.
4. **Temp ID collision** — use `crypto.randomUUID()`; prefix `temp_` for easy detection during reconcile.
