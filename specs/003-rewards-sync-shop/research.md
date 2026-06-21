# Research: Rewards, Sync & Shop

**Feature**: `003-rewards-sync-shop` | **Date**: 2026-06-21

## R1 — Root cause of per-device good morning / day-close duplication

**Decision**: Stale client data, not missing server fields. `amSeenAt` (`daily_reviews`) and `endedAt` (`day_status`) are already persisted server-side.

**Rationale**: `getAmRundownData()` runs only at SSR on `/today` load. `AmRundownModal` receives static `amRundown` props. Dismissing on device A updates the DB but device B keeps SSR props until full navigation or manual refresh. Similarly, closing a day on A does not invalidate B's cached Today/am state.

**Alternatives considered**:
- *localStorage dismissal flag* — rejected; contradicts FR-002 account-level requirement.
- *WebSockets push* — rejected; over-engineered for single-user PWA; React Query refetch on focus + invalidation on mutations is sufficient.

**Implementation**: Promote `amRundown` to React Query (`["amRundown"]` key) with `initialData` from server; invalidate on dismiss/end-day; optional `refetchOnWindowFocus: true`.

---

## R2 — Focus countdown cross-device inconsistency

**Decision**: Persist `focusTargetMinutes` on `time_blocks` row; countdown when `focusTargetMinutes > 0`, else count-up.

**Rationale**: `focus-session-storage.ts` stores `{ blockId, targetMinutes }` in `localStorage` only. Device B has no entry → clock shows elapsed (count-up) while device A counts down — matches reported bug.

**Alternatives considered**:
- *Sync localStorage via BroadcastChannel* — rejected; does not work across devices/browsers.
- *Separate `focus_sessions` table* — rejected; 1:1 with running block; column on `time_blocks` is simpler.

**Implementation**: Set `focusTargetMinutes` in `startBlockAction`; copy on boundary split; `RunningBlockPrimaryClock` reads from block payload in `getTodayData`.

---

## R3 — Habit allocation and auto-complete

**Decision**: Add `habitId` FK on `time_blocks`; on block stop with habit allocation, invoke existing `addHabitCountForToday` to satisfy `targetPerDay` for the business day.

**Rationale**: Schema already has `habitCompletionId` (legacy link) and `habitCompletions.linkedTimeBlockId`. New `habitId` on the block supports picker state before stop; on stop, create completion + update `habit_daily` via existing habit pipeline.

**Alternatives considered**:
- *Reuse `habitCompletionId` only* — rejected; cannot select habit before completion exists.
- *Auto-complete without time threshold* — accepted per clarification; any stopped block with habit allocation completes habit for the day.

---

## R4 — Allocation credit bonuses

**Decision**: Multiplicative stack: `hours × baseRate × qualityMult × allocationMult × dayCloseMult` (plus existing random bonus).

| Allocation | Multiplier |
|------------|------------|
| None | 1× |
| Task | 2× |
| Habit | 2× |
| Project | 3× |

**Rationale**: Spec clarification; matches user incentive model. Implement in shared `allocationCreditMultiplier()` used by `day-compute.ts` and `stats.ts`.

**Alternatives considered**:
- *Additive flat bonus* — rejected per clarification.
- *Highest-of stacking* — rejected per clarification.

---

## R5 — Category simplification migration

**Decision**: Replace `DEFAULT_CATEGORIES` with four entries; on `ensureDefaultCategories`, archive any existing category whose name is not in the approved set (case-insensitive match); rename `Chores` → `Cooking / Cleaning` in place when found.

**Rationale**: Spec requires four active categories only; historical blocks keep FK to archived categories. Sleep and Free time (earned) are archived — users can no longer log new blocks in those categories (accepted tradeoff per clarification).

**Alternatives considered**:
- *Delete legacy categories* — rejected; breaks historical FK display.
- *Keep Sleep/Free time active* — rejected per clarification.

**Follow-up**: Audit `isFreeTime` spending path — with Free time archived, credit "spending" category may be unused until a future category is marked `isFreeTime` in settings.

---

## R6 — Shop balance and redemption atomicity

**Decision**: Balance = `totalEarned - totalSpentOnFreeTime - totalRedeemed` (same formula as stats, extended). Redemption in a DB transaction: read computed balance, reject if insufficient, insert `shop_redemptions` row.

**Rationale**: Credits are derived from blocks, not a stored wallet column — avoids drift. Symbolic fulfillment needs only history + toast.

**Alternatives considered**:
- *Materialized `credit_balance` column on user* — rejected; duplicate source of truth.
- *Real coupon codes* — deferred; v1 symbolic only.

**Pricing**: Food Coupon **850**, PS5 **16,500** — validated against ~2,000–2,400 pts/week at 7–8 h/day × 6 days with bonuses.

---

## R7 — Intent field vs label column

**Decision**: UI rename only. Start flow uses `statedIntent` ("What will you be doing?"); stop/edit continues storing display text in `label` (existing validation requires non-empty on stop).

**Rationale**: Schema already distinguishes intent (start) vs finalized label (stop). Avoids migration; satisfies FR-008.

**Alternatives considered**:
- *Consolidate to single column* — rejected; unnecessary migration risk.
