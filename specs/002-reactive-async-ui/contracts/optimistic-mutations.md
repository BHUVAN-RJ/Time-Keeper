# Contract: Optimistic Mutation Helper

Shared client pattern in `web/src/lib/mutations/optimistic.ts`.

## `createOptimisticMutation<TCache>(options)`

Wrapper around `useMutation` defaults.

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `queryKey` | `QueryKey` | yes | Cache key to update |
| `mutationFn` | `(vars) => Promise<TResult>` | yes | Server action call |
| `applyOptimistic` | `(cache, vars) => TCache` | yes | Returns new cache after local change |
| `onReconcile?` | `(cache, result, vars) => TCache` | no | Merge server response (id swap, etc.) |
| `invalidateKeys?` | `QueryKey[]` | no | Additional keys to invalidate on settle |
| `errorMessage` | `string \| (err) => string` | no | Toast on failure |

### Lifecycle

1. **onMutate**: `cancelQueries(queryKey)`; `previous = getQueryData`; `setQueryData(applyOptimistic)`; return `{ previous }`.
2. **onError**: `setQueryData(previous)`; `toast.error(errorMessage)`.
3. **onSuccess**: if `onReconcile`, `setQueryData(onReconcile)`.
4. **onSettled**: `invalidateQueries` for `queryKey` and `invalidateKeys` (background, non-blocking).

### Rules

- MUST NOT call `router.refresh()`.
- MUST snapshot before mutate for rollback (FR-006).
- SHOULD run `invalidateQueries` without `await` in UI event handlers (FR-010).
- Temp ids MUST use prefix `temp_` (research R3).

## Server action return contract (creates)

Actions that create entities MUST return `{ id: string }` (or full row) for reconcile:

| Action | Current return | Required change |
|--------|----------------|-----------------|
| `createTaskAction` | `void` | `{ id: string }` |
| `createHabitAction` | `void` | `{ id: string }` |
| `createProjectAction` | `void` | `{ id: string }` |
| `createManualBlockAction` | partial | `{ id: string }` confirmed |

Updates/deletes may return `{ ok: true }` only if optimistic state needs no id swap.
