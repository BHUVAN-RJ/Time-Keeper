# Contract: Tasks Client Cache & Mutations

**Query root**: `["tasks"]`  
**Module**: `web/src/lib/queries/tasks.ts`  
**UI**: `web/src/components/tasks-client.tsx`, `TaskCard`

## Query

```typescript
useQuery({
  queryKey: queryKeys.tasks.all,
  queryFn: () => getTasksPageData(),
  initialData: serverInitial,      // from RSC page
  staleTime: 30_000,
});
```

Tab lists are **derived** from `data` via `useMemo` — no separate fetch per tab unless lazy-load optimization added later.

## Mutations

### `useCreateTaskMutation()`

| Step | Behavior |
|------|----------|
| Optimistic | Insert `TaskRow` into `todayTasks` / `backlogTasks` / `remainingTasks` based on `scheduledDate`, `dueDate`, `status`; add to `matrixByQuadrant` if urgency/importance set |
| Form | Clear title/fields immediately on mutate (not on success) |
| Server | `createTaskAction(...)` → `{ id }` |
| Reconcile | Replace `temp_*` id; remove `_optimistic` |
| Invalidate | `["tasks"]`; if scheduled today also `["today"]` |

### `useCompleteTaskMutation()`

| Step | Behavior |
|------|----------|
| Optimistic | Set `status: "completed"` on matching task in all arrays; keep in list with strikethrough |
| Server | `completeTaskAction(taskId)` → score toast fields |
| On success | Show score toast if `showScoreToast` |
| Invalidate | `["tasks"]`, `["today"]`, `["stats"]` (background) |

### `useDropTaskMutation()`, `useScheduleForTodayMutation()`, `useUpdateTaskMutation()`

Same optimistic pattern: patch task in all lists where `task.id` matches; move between lists when status/date changes.

## TaskCard UX contract

- **MUST NOT** use wrapper `run()` that sets global `busy` on all buttons.
- Each action button MAY use `mutation.isPending && mutation.variables?.taskId === task.id` for single-button disable.
- **MUST** reflect optimistic `status` for strikethrough immediately.

## Tasks hub contract (`tasks-hub-client.tsx`)

| View | Data source | Switch behavior |
|------|-------------|-----------------|
| `tasks` | `["tasks"]` from parent or self | Instant — already mounted or cached |
| `habits` | `["habits", "manage"]` | Instant view switch; fetch on first open if missing |
| `projects` | `["projects"]` | Instant; `ProjectsClient` already useQuery |

URL sync: `router.replace(pathname + ?view=habits, { scroll: false })` without blocking on RSC.

## Removal targets

- Delete `refresh()` function calling `router.refresh()` in `tasks-client.tsx`.
- Remove `pending` state gating entire create form after optimistic insert.
