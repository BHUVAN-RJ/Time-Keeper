# Data Model: Rewards, Sync & Shop

**Feature**: `003-rewards-sync-shop` | **Date**: 2026-06-21

Deltas to `web/src/db/schema.ts`. Unchanged tables omitted. Generate via `drizzle-kit generate` + `migrate`.

---

## 1. `time_blocks` (extend)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `habitId` | `text` FK → `habits.id` | yes | Allocation target when type = Habit; mutually exclusive with `taskId` / `projectId` |
| `focusTargetMinutes` | `integer` | yes | When `> 0`, UI counts down from this duration; `null` = count-up only |

**Rules**:
- At most one of `taskId`, `habitId`, `projectId` non-null (enforce in server actions).
- On stop with `habitId`: create habit completion + update `habit_daily` to satisfy `targetPerDay` for business day.
- `splitRunningBlockAtBoundary` MUST copy `habitId`, `taskId`, `projectId`, `focusTargetMinutes`, `statedIntent`.

**Clock mode** (derived, not stored): `focusTargetMinutes > 0` → countdown; else elapsed.

---

## 2. `categories` (behavioral migration)

No new columns. Approved active names (case-insensitive):

| Name | baseCreditRate | isFreeTime |
|------|----------------|------------|
| Deep Work | 15 | false |
| Admin / Shallow | 5 | false |
| Cooking / Cleaning | 5 | false |
| Exercise | 8 | false |

**Migration**:
- New users: seed only these four (`archived = false`).
- Existing users: `archived = true` for all categories not in approved list; rename `Chores` → `Cooking / Cleaning` if present.
- Pickers for new blocks: `WHERE archived = false`.

---

## 3. `shop_items` (new)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` PK | UUID default |
| `slug` | `text` | unique — `food-coupon`, `ps5` |
| `name` | `text` | NOT NULL |
| `description` | `text` | nullable |
| `costPoints` | `integer` | NOT NULL, > 0 |
| `active` | `boolean` | default true |
| `sortOrder` | `integer` | default 0 |
| `createdAt` | `timestamp_ms` | NOT NULL |

**Seed data**:

| slug | name | costPoints |
|------|------|------------|
| `food-coupon` | Food Coupon | 850 |
| `ps5` | PlayStation 5 | 16,500 |

---

## 4. `shop_redemptions` (new)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` PK | UUID default |
| `userId` | `text` FK → `users.id` | NOT NULL, cascade delete |
| `shopItemId` | `text` FK → `shop_items.id` | NOT NULL |
| `pointsSpent` | `integer` | NOT NULL — snapshot of cost at redeem time |
| `redeemedAt` | `timestamp_ms` | NOT NULL |

**Index**: `(userId, redeemedAt DESC)` for history queries.

**State**: Append-only; no refunds in v1.

---

## 5. Existing entities (unchanged schema, clarified usage)

### `daily_reviews.amSeenAt`

- Key: `(userId, businessDayDate)`.
- Drives good-morning hide when set for today's business day.
- MUST be read fresh on multi-device (React Query).

### `day_status.endedAt`

- Key: `(userId, businessDayDate)`.
- Drives unclosed-day detection in `listUnclosedDaysBeforeToday`.
- Closing on any device MUST prevent re-prompt on others after cache refresh.

### `habit_completions` / `habit_daily`

- Populated when block stops with `habitId` allocation (auto-complete for day).

---

## Client cache extensions

| Query key | Data shape | Notes |
|-----------|------------|-------|
| `["amRundown"]` | `AmRundownData` | SSR `initialData`; refetch on focus |
| `["shop"]` | `ShopPageData` | balance, items, redemptions |
| `["today"]` | extended | includes `focusTargetMinutes`, allocation fields on running block |

### AllocationPicker state (UI-only)

| Field | Type | Description |
|-------|------|-------------|
| `allocationType` | `"project" \| "habit" \| "task" \| null` | First dropdown |
| `allocationId` | `string \| null` | Second dropdown value |

On save: map to exactly one FK on `time_blocks`.

---

## Credit balance (computed)

```
balance = Σ(earned blocks) - Σ(free-time spent) - Σ(redemption.pointsSpent)
```

Where earned per block:

```
hours × category.baseCreditRate × qualityMult × allocationMult × (dayCloseMult if day ended)
```

`allocationMult` ∈ {1, 2, 3} from `allocation-bonus.ts`.
