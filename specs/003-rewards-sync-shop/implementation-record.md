# Rewards, Sync & Shop — implementation record

**Branch:** `003-rewards-sync-shop` (pushed to origin)  
**Spec Kit:** `specs/003-rewards-sync-shop/`  
**Shipped:** June 2026  
**Migration:** `web/drizzle/0016_early_grim_reaper.sql` (applied to Turso prod via `npm run db:migrate`)

## Summary

Cross-device sync for AM rundown and day-close state, server-backed focus countdown, dual-dropdown time allocation (project / habit / task) with multiplicative credit bonuses, four active categories, task completion from Today home, intent-field copy refresh, and a symbolic points shop.

## Routes

| Route | Notes |
|-------|--------|
| `/shop` | Catalog, balance, redeem, redemption history |
| `/today` | Allocation on stop/manual/edit; focus countdown from server; complete pinned top-3 |

All prior routes unchanged. Nav adds **Shop**.

## Schema (migration `0016`)

**`time_blocks` (new columns)**

- `habit_id` — optional FK-style link for habit allocation
- `focus_target_minutes` — server-authoritative focus countdown (minutes from block start)

**New tables**

- `shop_items` — catalog (seeded: Food Coupon 850 pts, PS5 16,500 pts)
- `shop_redemptions` — per-user redemption history

Shop catalog seeds on first shop page load via `ensureShopCatalog()` in `web/src/lib/seed-shop.ts`.

## Credit bonuses (multiplicative)

Allocation multiplier stacks with quality and day-close multipliers:

| Allocation | Multiplier |
|------------|------------|
| None | 1× |
| Task | 2× |
| Habit | 2× (auto-completes habit for the day on stop) |
| Project | 3× |

Helpers: `web/src/lib/allocation-bonus.ts`, `web/src/lib/credit-balance.ts`.

## Categories

**Active pickers (new users + migrated accounts):** Deep Work, Admin / Shallow, Cooking / Cleaning, Exercise.

Legacy categories (Sleep, Free time, Regular work, Learning, etc.) are **archived** — historical blocks still display their original names.

## Multi-device sync

- `useAmRundownQuery` + `queryKeys.amRundown` — good morning / unclosed-day modal
- Dismiss or end-day invalidates `amRundown`, `today`, `week`, `stats`
- Focus countdown reads `running.focusTargetMinutes` from server; `localStorage` only during optimistic start window

## Deploy checklist

After pulling this branch:

```bash
cd web
source .env.local   # or direnv
npm run db:migrate  # applies through 0016
npm run typecheck && npm run lint
```

**Note:** `0016` was hand-trimmed to delta-only SQL (add columns + shop tables). Do not replace with a full drizzle-kit snapshot migration on existing databases.

**Git push:** use `gh auth setup-git` if HTTPS push fails with the wrong GitHub account.

## Manual verification

See [`quickstart.md`](./quickstart.md) (12 scenarios).

## Key files

| Area | Path |
|------|------|
| Schema | `web/src/db/schema.ts` |
| Migration | `web/drizzle/0016_early_grim_reaper.sql` |
| Time blocks + allocation | `web/src/actions/time-blocks.ts` |
| Shop | `web/src/actions/shop.ts`, `web/src/components/shop-client.tsx` |
| Allocation UI | `web/src/components/allocation-picker.tsx` |
| AM sync | `web/src/lib/queries/am-rundown.ts`, `web/src/components/am-rundown-modal.tsx` |
| Today wiring | `web/src/components/today-client.tsx` |
