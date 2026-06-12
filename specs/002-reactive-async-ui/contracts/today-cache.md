# Contract: Today Dashboard Cache & Mutations

**Query root**: `["today"]`  
**Module**: existing in `today-client.tsx`; extract mutations to `web/src/lib/mutations/today.ts`  
**UI**: `today-client.tsx`, `today-habits-panel.tsx`, `focus-mode-view.tsx`

## Query (existing)

```typescript
useQuery({
  queryKey: ["today"],
  queryFn: getTodayData,
  initialData: initial,
  refetchInterval: 60_000,  // preserve polling
});
```

Fingerprint / `pollTodayData` behavior unchanged.

## Mutations

### `startBlock` — EXISTING (reference implementation)

Already optimistic in `onStart()`:
- Inserts running block into cache immediately
- Rolls back on `ALREADY_RUNNING` or error
- Re-points focus session to real `blockId` on success

**No change required** except extract to shared helper for consistency.

### `stopBlock` — NEW optimistic

| Step | Behavior |
|------|----------|
| Optimistic | Clear `runningBlock`; append to `blocks` with `endAt: now`, provisional quality/label from form |
| Local | `clearFocusSession()`; close stop dialog immediately |
| Server | `stopBlockAction(...)` |
| On success | Apply `luckyBonus` toast if returned |
| On error | Restore running block + reopen dialog state |

### `createManualBlock`, `updateBlock`, `deleteBlock` — NEW optimistic

- Manual create: insert block row with `temp_` id
- Update: patch block in list
- Delete: remove from list immediately

### `today-habits-panel` habit toggle

| Step | Behavior |
|------|----------|
| Optimistic | Toggle `hit` / count in local habits array |
| Server | existing habit log action |
| Invalidate | `["today"]` extras or habits sub-query on settle |

## Rules

- Stop dialog **MAY** close before server confirms (FR-008).
- Running timer clock **MUST** stop immediately when optimistic stop applied.
- `invalidateQueries(["today"])` after mutations SHOULD be fire-and-forget (no `await` blocking UI).
