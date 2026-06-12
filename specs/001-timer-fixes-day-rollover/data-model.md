# Phase 1 Data Model: Timer Fixes & 4 AM Day Rollover

Scope: changes to the existing Drizzle/libSQL schema (`web/src/db/schema.ts`). Only **deltas** are described; unchanged tables/columns are omitted. All migrations are produced via `drizzle-kit generate` and applied with `drizzle-kit migrate`. Migrations should be **additive and idempotent** where possible.

---

## Conceptual entities (from spec)

| Entity | Backing table(s) | Notes |
|--------|------------------|-------|
| Time Block | `time_blocks` | Source of truth for tracked time; running = `endAt IS NULL` |
| Business Day | `day_status` (+ `daily_reviews`) | 4 AM-based `date` string; auto-closed |
| Task | `tasks` | Now editable; remaining-list source; completion strikethrough |
| Label | `categories` | Renamed concept; absorbs free-text label; inline-creatable |
| Active Window | `user_preferences` | New start/end columns |
| Good Morning State | `daily_reviews.amSeenAt` | Keyed by 4 AM business day |

---

## 1. `categories` → conceptual **Label**

**Change**: No physical column rename (kept as `categories` to avoid risky migration). UI and docs refer to it as **Label**.

- Existing columns retained: `id`, `userId`, `name`, `baseCreditRate`, `color`, `isFreeTime`, `archived`, `createdAt`.
- **Behavioral rules**:
  - Inline-created Labels (from the expandable picker) MUST use neutral defaults: `baseCreditRate = NEUTRAL_RATE` (a defined constant, e.g. `1.0`), `color` auto-assigned from the palette default, `isFreeTime = false`, no associated `schedule_goals` row. (FR-022a)
  - Labels remain editable in Label management (formerly Categories): name, credit rate, color, goal, archive.
- **Validation**: `name` non-empty, unique per user (enforce in action layer; optional unique index `categories_user_name` may be added).

---

## 2. `time_blocks`

**Change**: Deprecate the standalone free-text label.

- `label` (`text`, nullable): **retained** for historical data and backward compatibility, but **no longer a separately-edited field** in start/stop/manual UI. New blocks may leave it null; classification is via `categoryId` (the Label). May still be auto-populated from a linked task title (existing behavior) without surfacing an editable field.
- `categoryId` (existing, `NOT NULL`, FK → `categories`): now the single classification dimension ("Label").
- `statedIntent` (existing, nullable): retained as the optional "what are you doing" note.
- No column added; the running-block partial unique index `time_blocks_user_running_unique` is unchanged and must be honored by the split/restart transaction (R3).

**State (running → closed)**: A running block has `endAt = NULL`. The 4 AM split sets `endAt` to the boundary instant and inserts a new running block carrying `categoryId`, `statedIntent`, `projectId`, `taskId`.

---

## 3. `day_status`

**Change**: Track auto-close and cache wasted minutes.

- **Add** `wastedMinutes` (`integer`, NOT NULL, default `0`): cached derived wasted minutes for the (closed) business day. Recomputed when the day closes; derived live for the open/today view.
- **Add** `autoClosed` (`integer` boolean, NOT NULL, default `false`): `true` when the day was finalized by silent reconciliation rather than a manual End Day.
- `date` semantics change: now represents the **4 AM business day** (`YYYY-MM-DD`). No type change; only the value-producing helper changes (R1). PK `(userId, date)` unchanged.
- `endedAt`, credits, `productivityScore`, etc.: unchanged columns; `endedAt` is now set by auto-close as well as manual close.

---

## 4. `daily_reviews`

**Change**: None to schema. Behavior:

- `amSeenAt` now keyed by 4 AM business `date` (R9).
- `pmCompletedAt`, `mood`, `notes`, `tomorrowsPlanJson` remain **optional** and are no longer required to close a day (FR-006a). The reflective review is offered post-hoc (good-morning screen) for the most recently closed day.

---

## 5. `user_preferences`

**Change**: Add active-window columns; deprecate tags flag.

- **Add** `activeWindowStart` (`text`, NOT NULL, default `'09:00'`): `HH:MM` (24h) in user TZ; start of the wasted-time evaluation window.
- **Add** `activeWindowEnd` (`text`, NOT NULL, default `'21:00'`): `HH:MM` end of the window. A value ≤ start is interpreted as crossing midnight (clamped to the business day).
- `tagsEnabled` (existing): **deprecated** — no longer read by the app after tag removal (R6). Column retained for one release; safe to drop in a later migration.
- Other columns unchanged.

**Validation**: `HH:MM` format `^([01]\d|2[0-3]):[0-5]\d$`; enforced in `preferences` action.

---

## 6. Tags tables (`tags`, `task_tags`, `time_block_tags`)

**Change**: **Deprecated / unused** (R6).

- No destructive migration required by the spec. Tables remain but the app stops reading/writing them and removes all tag UI and reporting.
- Relations (`tagsRelations`, references in `usersRelations`) may be left in place; tag pickers and `tagBreakdown` are removed from the app surface.
- A **follow-up** migration MAY drop these tables once confirmed no longer needed (out of scope for the core change).

---

## 7. Google Calendar items (no DB table for tasks)

- GCal events are cached in `google_calendar_event_cache.eventsJson` (not first-class tasks). The **passed-strikethrough** for GCal items (FR-017) is a **presentation rule** in `calendar-events-list.tsx` based on the event's date vs. the current business day/week; no schema change.

---

## Derived (non-persistent) computations

| Derived value | Computed in | Inputs |
|---------------|-------------|--------|
| Business day key / range | `lib/day-boundary.ts` | `now`, `users.timezone` |
| Wasted minutes (live) | `lib/wasted-time.ts` | active window, business-day blocks |
| Per-Label time | stats/month aggregation | `time_blocks.categoryId`, durations |
| Remaining tasks list | `actions/tasks.ts` query | `tasks` where `status NOT IN (completed, dropped)` ordered overdue/today → upcoming → undated |

---

## Migration checklist (drizzle-kit)

1. `day_status`: add `wasted_minutes INTEGER NOT NULL DEFAULT 0`, `auto_closed INTEGER NOT NULL DEFAULT 0`.
2. `user_preferences`: add `active_window_start TEXT NOT NULL DEFAULT '09:00'`, `active_window_end TEXT NOT NULL DEFAULT '21:00'`.
3. (Optional, later) drop `tags`, `task_tags`, `time_block_tags`, and `user_preferences.tags_enabled`.

No backfill is required: defaults cover existing rows; existing `day_status.date` values remain valid (interpretation shifts to business-day going forward, which is acceptable for historical records).
