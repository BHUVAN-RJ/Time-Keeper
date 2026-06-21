# Contract: AM Rundown & Day-Close Sync

Ensures account-level good-morning and day-close state across devices.

## Query

**Key**: `["amRundown"]`

**Fetcher**: `getAmRundownData()`

**SSR**: `today/page.tsx` passes result as `initialData` to `useQuery`.

**Options**:
- `staleTime`: 30_000 ms
- `refetchOnWindowFocus`: true

## Mode logic (server — unchanged)

| Condition | `mode` |
|-----------|--------|
| `unclosedDays.length > 0` | `"unclosed"` |
| else `!todayReview.amSeenAt` | `"rundown"` (Good morning) |
| else | `"hidden"` |

Business day boundary: 4 AM user timezone (`calendarDayInTz`).

## Invalidation triggers

| Action | Invalidate keys |
|--------|-----------------|
| `dismissAmRundownAction` | `amRundown`, `today` |
| `submitEndDayAction` | `amRundown`, `today`, `week`, `stats` |
| `batchCloseUnclosedDaysAction` | same as end day |

## Component contract

`AmRundownModal`:
- MUST use `useQuery` for data (not props-only after hydration).
- MAY accept `initialData` from page for zero-flicker SSR.
- On successful dismiss/close: `queryClient.setQueryData(["amRundown"], { mode: "hidden", ... })` optimistically, then invalidate.

## Acceptance mapping

- **SC-001**: Close day device A → device B refetch on focus shows `mode !== "unclosed"` for that date.
- **SC-002**: Dismiss good morning device A → device B `amSeenAt` present → `mode === "hidden"`.

## Anti-patterns (forbidden)

- `localStorage` flags for AM dismissal.
- Relying solely on SSR props without refetch on second device.
