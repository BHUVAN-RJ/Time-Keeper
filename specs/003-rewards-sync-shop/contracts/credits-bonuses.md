# Contract: Credits & Allocation Bonuses

Shared helper: `web/src/lib/allocation-bonus.ts`

## `allocationCreditMultiplier(block)`

```ts
type BlockAllocation = {
  taskId: string | null;
  habitId: string | null;
  projectId: string | null;
};

function allocationCreditMultiplier(b: BlockAllocation): number;
```

| Condition | Return |
|-----------|--------|
| `projectId` set | `3` |
| `taskId` set (no project) | `2` |
| `habitId` set (no project/task) | `2` |
| none set | `1` |

Priority if multiple set (should not happen): project > task > habit — server MUST reject multiples before compute.

## Per-block credit formula

```ts
const hours = overlapMinutes / 60;
let raw =
  hours *
  category.baseCreditRate *
  qualityCreditMultiplier(quality) *
  allocationCreditMultiplier(block);
if (block.randomBonusApplied) raw *= 1.5;
```

## Day-close multiplier (unchanged)

Applied in `buildDaySnapshot` when `statusRow.endedAt` set:

| goalHitPercent | mult |
|----------------|------|
| ≥ 100 | 1.5 |
| ≥ 80 | 1.2 |
| else | 1 |

## Habit auto-complete on block stop

When `stopBlockAction` receives `habitId`:

1. Resolve business day from user timezone.
2. Call `addHabitCountForToday(userId, timezone, habitId, need)` where `need = max(0, targetPerDay - currentCount)`.
3. Optionally set `habitCompletionId` / `linkedTimeBlockId` on completion row.

Invalidate: `["today"]`, `["habits"]`, `["week"]`, `["stats"]`.

## Stats / shop balance

`getStatsPageData` and `getShopPageData` MUST use the same balance function:

```ts
balance = earned - spent - redeemedTotal
```

Extract to `lib/credit-balance.ts` if duplicated after change.
