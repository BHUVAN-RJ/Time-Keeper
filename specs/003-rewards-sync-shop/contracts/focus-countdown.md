# Contract: Focus Countdown Sync

Moves focus timer target from device-local storage to server-backed block field.

## Schema

`time_blocks.focusTargetMinutes: integer | null`

- `null` or `0`: count-up (elapsed) primary clock.
- `> 0`: countdown primary clock; remaining = `focusTargetMinutes * 60 - elapsedSeconds`.

## Server actions

### `startBlockAction(categoryId, taskId?, statedIntent?, focusTargetMinutes?)`

- Persist `focusTargetMinutes` on new running block when provided and `> 0`.
- Return `{ blockId }` including field in subsequent `getTodayData`.

### `splitRunningBlockAtBoundary`

Copy `focusTargetMinutes` to new running block segment.

### `stopBlockAction`

No change to focus field (block ends); clear client localStorage.

## `getTodayData` / `TodayBlockRow`

Extend running block payload:

```ts
{
  // existing fields...
  focusTargetMinutes: number | null;
}
```

## Client: `RunningBlockPrimaryClock`

Resolution order:

1. `focusTargetMinutes` from server block data (authoritative).
2. During optimistic start (temp block id): `readFocusSession()` fallback until server id reconciled.
3. After reconcile: `writeFocusSession` deprecated — remove writes once server round-trip completes.

## Focus complete event

When `remainSec <= 0` and countdown mode:
- Fire `onFocusGoalComplete` once per block segment (existing `focusCompleteFired` ref).
- Same on all devices viewing the running block.

## Acceptance

**SC-003**: Second device remaining time within 2 s of first (network fetch + shared `startAt` + `focusTargetMinutes`).
