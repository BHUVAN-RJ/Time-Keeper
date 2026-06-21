# Quickstart: Rewards, Sync & Shop

Manual verification for feature `003-rewards-sync-shop`.

**Status:** Implemented and shipped (June 2026). See [`implementation-record.md`](./implementation-record.md).

**Prereqs**: `cd web && npm run dev`; logged-in user; migration **`0016`** applied (`source .env.local && npm run db:migrate`); two browsers or one normal + one incognito (simulate two devices).

**Quality gates**:

```bash
cd web && npm run typecheck && npm run lint
```

---

## 1. Good morning — once per account (SC-002)

1. Open `/today` in Browser A after 4 AM with no prior dismissal today.
2. **Expect**: Good morning or unclosed-day modal appears.
3. Dismiss / Start day.
4. Open `/today` in Browser B (same account).
5. **Expect**: No good morning modal (may briefly flash then hide after fetch — acceptable if < 1 s).

## 2. Day close — sync across devices (SC-001)

1. Ensure yesterday (or prior day) is unclosed; Browser A shows unclosed prompt.
2. Close the day fully in Browser A.
3. Open or focus Browser B on `/today`.
4. **Expect**: No prompt to close the same day again.

## 3. Focus countdown — two devices (SC-003)

1. Browser A: start timer with 25-minute focus goal.
2. Browser B: open `/today` within 1 minute.
3. **Expect**: Both show countdown (not count-up); remaining times within ~2 seconds.

## 4. Allocation dropdowns (SC-004)

1. Start timer, stop, open stop dialog.
2. **Expect**: Type dropdown (Project / Habit / Task) + entity dropdown.
3. Select Task → pick an open task → save.
4. **Expect**: Block row shows task; credits reflect 2× bonus in day summary.

## 5. Habit auto-complete

1. Stop a block allocated to a habit not yet completed today.
2. **Expect**: Habit shows complete on Today habits panel without separate tap.

## 6. Project 3× bonus

1. Log 1 h Deep Work (useful) linked to a project.
2. **Expect**: Credits ≈ `1 × 15 × 1 × 3 = 45` before day-close multiplier.

## 7. Categories — four only

1. Start new timer; open category picker.
2. **Expect**: Only Deep Work, Admin / Shallow, Cooking / Cleaning, Exercise.
3. View an old block on a legacy category (if any).
4. **Expect**: Still displays original category name.

## 8. Complete task from home (SC-006)

1. Ensure pinned top-3 or today task visible on `/today`.
2. Tap Done.
3. **Expect**: Task struck through / removed; same toast as Tasks page; persists on refresh.

## 9. Intent field copy (FR-008)

1. Start or stop timer.
2. **Expect**: Field labeled for one-line intent ("what you will be doing"), not "Label".

## 10. Shop redemption (SC-007)

1. Ensure balance ≥ 850 (or temporarily lower threshold in dev).
2. Open `/shop`.
3. Redeem Food Coupon.
4. **Expect**: Balance −850; item in history; Stats balance matches.

## 11. Insufficient balance

1. With balance < 16,500, attempt PS5 redeem.
2. **Expect**: Blocked with clear message; balance unchanged.

## 12. Multi-device shop balance

1. Redeem in Browser A.
2. Open Shop in Browser B.
3. **Expect**: Updated balance after load/refetch.
