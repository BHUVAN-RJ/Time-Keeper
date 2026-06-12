# Phase 0 Research: Timer Fixes & 4 AM Day Rollover

This document resolves the technical unknowns implied by the spec and Technical Context. Each item records the **Decision**, **Rationale**, and **Alternatives considered**.

---

## R1. 4:00 AM day boundary representation

**Decision**: Introduce a single shared helper module (`web/src/lib/day-boundary.ts`) exposing a `DAY_BOUNDARY_HOUR = 4` constant and two functions:
- `businessDayInTz(now, tz)` → `YYYY-MM-DD` of the 4 AM-based day. Implemented by subtracting 4 hours from `now` (in the user's TZ) before formatting, so times from 00:00–03:59 map to the previous calendar date.
- `getBusinessDayRangeUtc(now, tz)` → `{ startUtc, endUtc }` spanning local 04:00:00.000 of the business day to local 04:00:00.000 of the next day, converted to UTC via `date-fns-tz`.

All day-scoped logic switches from `calendarDayInTz` / `getDayRangeUtc` to these helpers.

**Rationale**: Centralizing the 4 AM offset avoids scattering `-4h` arithmetic across the codebase and keeps DST correctness in one place (offset is applied in zoned time, then converted to UTC). Reusing `date-fns-tz` matches existing code in `day-range.ts`.

**Alternatives considered**:
- Storing a per-user configurable boundary hour — rejected: spec fixes the boundary at 4:00 AM; configurability is unnecessary scope.
- Editing `calendar-day.ts` in place to always subtract 4h — rejected: some non-day-scoped callers may legitimately want the literal calendar date; a new explicit helper is safer and greppable. The old helpers remain for any literal-calendar use and are migrated case-by-case.

---

## R2. Silent auto-close "at 4:00 AM" on a serverless host

**Decision**: Implement auto-close as **lazy, idempotent reconciliation** rather than a scheduled job. A `reconcileDayRollover(userId, now)` routine runs at the start of the primary authenticated data loads/actions (Today data fetch, AM rundown load, and timer actions). It:
1. Computes the current business day.
2. Splits a running block at the boundary if it started in a prior business day (see R3).
3. Finds business days `< today` that have activity but no `day_status.endedAt`, and finalizes each silently (compute metrics/score, roll incomplete system tasks forward, mark `endedAt` + `autoClosed = true`) without prompting.

Reconciliation is guarded to be cheap when there is nothing to do (single indexed lookup) and safe to run concurrently (idempotent upserts keyed by `userId + date`).

**Rationale**: The deployment has no guaranteed always-on cron, so a clock-driven close is unreliable. Lazy reconciliation guarantees correctness whenever the user actually interacts, which is exactly when they would observe state. It also naturally handles multi-day absences (close oldest-first).

**Alternatives considered**:
- External cron / scheduled function hitting an endpoint per user — rejected for now: added infra, auth, and per-user fan-out complexity; can be layered on later to close days even without a visit, but is not required to satisfy the spec.
- Client-side timer firing at 4 AM — rejected: unreliable (tab closed/asleep) and not authoritative.

---

## R3. Running-timer split & restart at the boundary

**Decision**: During reconciliation, if a running block (`endAt IS NULL`) has `startAt` before the current business-day start, set its `endAt` to the most recent crossed boundary instant (local 04:00 in UTC) and insert a **new** running block for the new day copying `categoryId` (the Label), `statedIntent`, `projectId`, and `taskId`; `label`/`quality` left as before/null. If multiple boundaries were crossed (long-running), only one fresh running block is created for the current day; intermediate days receive a closed block segment each so per-day attribution is correct.

The DB partial unique index `time_blocks_user_running_unique` is respected by closing the old block in the same transaction before inserting the new one.

**Rationale**: Preserves "no time lost" and correct per-day minutes while honoring the single-running-block invariant. Copying context satisfies FR-007.

**Alternatives considered**:
- Leaving one block spanning days and attributing via overlap only (current behavior) — rejected: the running block then "belongs" to the new day for editing/stop UX and is the source of the rollover confusion; explicit segments are clearer and fix the defect.

---

## R4. Timer "app becomes unusable" defect

**Decision**: Treat the defect as a combination of (a) day-rollover state confusion (fixed by R1–R3) and (b) the focus overlay's interaction layering. Ensure the stop/label control in `focus-mode-view.tsx` is always within an interactive (`pointer-events-auto`) region and never covered by a `pointer-events-none` clock layer, and that opening the stop dialog cannot be blocked by a stale running-state mismatch. Add a defensive "force stop / recover" path so a block that cannot be reconciled can always be ended.

**Rationale**: The spec's #1 symptom is being unable to label/stop. Guaranteeing the control is reachable and adding a recovery path directly satisfies FR-001–FR-003 and SC-001 even if an unforeseen state arises.

**Alternatives considered**:
- Only fixing rollover math — rejected: does not guarantee reachability of the control under other edge states; the spec demands the app "never locks".

---

## R5. Optimistic / instant timer start

**Decision**: Refactor `onStart` to be local-first using react-query optimistic updates:
1. Immediately write an optimistic `running` block into the `["today"]` query cache (and any zustand UI state) and transition to the focus view synchronously.
2. Fire `startBlockAction` in the background (no `await` blocking the transition).
3. On success, reconcile the optimistic block id with the server id via cache update (no visible change).
4. On failure (including the "already running" conflict from the unique index), roll back the optimistic state, surface a `sonner` toast, and offer recovery (e.g., reload running state / stop existing block) without discarding elapsed time.

**Rationale**: Meets SC-003 (<200 ms perceived) and FR-009–FR-011 while keeping the authoritative single-running-block guarantee server-side.

**Alternatives considered**:
- Keep awaiting the server but show a spinner — rejected: still blocks UX, the exact pain point.
- Fully client-authoritative timers persisted only to local storage — rejected: breaks cross-device consistency and the existing server-backed model.

---

## R6. Removing tags

**Decision**: Remove tags from the product surface in two layers:
- **UI/logic**: delete `tag-picker.tsx` and `tags-settings.tsx`, remove tag pickers from stop/manual-block/task-create flows, remove the tag breakdown from month/stats, and stop reading/writing `tagsEnabled`.
- **Data**: keep the `tags`, `task_tags`, `time_block_tags` tables in place but unused for one release (no destructive drop required by spec), and add a follow-up migration option to drop them. Historical tag data becomes non-user-visible (satisfies SC-008 and the Assumptions note).

**Rationale**: Satisfies "no tag UI/reporting remains" with minimal risk; deferring the destructive table drop avoids data-loss surprises and keeps the migration reversible.

**Alternatives considered**:
- Immediate hard drop of tag tables — rejected as unnecessarily destructive for the spec's requirement (user-invisibility is sufficient); can be done later.

---

## R7. Merging Category + free-text label into a single "Label"

**Decision**:
- Treat the existing `categories` table as the **Label** entity (rename in UI strings, keep table/columns to avoid a risky data rename). A Label keeps `baseCreditRate`, `color`, `archived`, and may have a `schedule_goal`.
- Stop using `time_blocks.label` as a separate required field. Classification of a block = its `categoryId` (the Label). The free-text label field is removed from start/stop/manual UI; the `label` column is retained (nullable, deprecated) for historical data and is no longer surfaced as an editable separate field. `statedIntent` remains the optional "what are you doing" note.
- Replace the category `<select>` with an **expandable picker** (combobox) that lists existing Labels and supports inline creation. Inline-created Labels are inserted with neutral defaults: `baseCreditRate` = a defined neutral rate, auto-assigned `color`, no `schedule_goal` (FR-022a).
- Per-label analysis reuses existing category-minutes aggregation (now surfaced on the stats page as "time per Label").

**Rationale**: Merging onto the richer entity (categories, which already drive color/credit/goal/score) preserves scoring semantics while eliminating the redundant free-text label, exactly per the clarified FR-021. Avoiding a physical table rename minimizes migration risk.

**Alternatives considered**:
- Promote the free-text `label` to the single dimension and drop categories — rejected: would lose credit rates/colors/goals that the productivity score depends on, a large regression.
- Physically rename `categories`→`labels` table/columns — rejected: high-risk migration for a cosmetic gain; UI-level renaming is sufficient.

---

## R8. Wasted-time computation

**Decision**: Add an active window to `user_preferences` (`active_window_start`, `active_window_end` as `HH:MM` text, defaults `09:00`/`21:00`). Add `web/src/lib/wasted-time.ts` computing, for a business day: intersect the active window with the day, subtract the union of recorded block intervals (clipped to the window), and report the remaining minutes as **wasted**. The value is derived on read (and cached into `day_status.wastedMinutes` when a day is closed). Wasted minutes count against the productivity score as uncredited time in `productivity-scores.ts`. Because it is derived, retroactively logging a block over a gap automatically reduces wasted minutes (FR-026a/b).

**Rationale**: Derived computation keeps data clean and "reclaimable", matches the clarified Q3 answer, and slots into the existing day-compute/score pipeline.

**Alternatives considered**:
- Materializing "wasted" blocks — rejected per clarification (clutters the log; harder to reclaim).
- Window stored as minutes-of-day integers — acceptable but `HH:MM` text is more legible and consistent with existing date strings; either is fine.

**Edge handling**: The window is interpreted within the 4 AM business day; a window crossing midnight (e.g., 21:00–02:00) is supported by clamping to the business-day range.

---

## R9. Good-morning screen gating on 4 AM day

**Decision**: Keep using `daily_reviews.amSeenAt` keyed by `date`, but compute `date` via `businessDayInTz` (R1). The good-morning screen shows when there is no `amSeenAt` for the current business day (and no blocking unclosed days, which now auto-close per R2). The optional reflective review (mood/notes/plan) for the most recently closed day is offered from this screen (FR-006a) and is dismissible/non-blocking.

**Rationale**: Minimal change — only the day key changes — and naturally yields "first open after 4 AM" semantics (FR-018/019).

**Alternatives considered**:
- Time-of-day trigger (e.g., show at literal 4 AM) — rejected: the spec says first *login/open* after 4 AM, not a push at 4 AM.

---

## R10. Strikethrough for completed & passed items

**Decision**:
- **Completed tasks** (all sources): apply strikethrough styling when `status = completed` in task lists (`tasks-client.tsx`, pinned/today panels).
- **Passed Google-Calendar items**: in `calendar-events-list.tsx`, apply strikethrough to GCal-sourced items whose scheduled day/week (business-day based) is in the past and that were not completed. System-defined tasks are explicitly excluded from passed-strikethrough and keep roll-forward behavior (clarified Q4).

**Rationale**: Directly encodes the clarified scope; styling-only for the GCal case (events are cached, not DB tasks).

**Alternatives considered**:
- Applying passed-strikethrough to all tasks — rejected per clarification.

---

## Summary of resolved unknowns

| # | Topic | Decision (short) |
|---|-------|------------------|
| R1 | Day boundary | New `day-boundary.ts`, 4 AM-shifted day key + range |
| R2 | Auto-close | Lazy idempotent reconciliation on data loads/actions |
| R3 | Timer split | Close at boundary + restart new block carrying context |
| R4 | Unusable defect | Guarantee stop/label reachability + recovery path |
| R5 | Instant start | react-query optimistic update, background sync, rollback |
| R6 | Remove tags | Strip UI/logic; keep tables unused (optional later drop) |
| R7 | Single Label | categories = Label; deprecate free-text `label`; expandable picker |
| R8 | Wasted time | Active window pref; derived in-window gap minutes; affects score |
| R9 | Good morning | amSeenAt keyed by 4 AM business day |
| R10 | Strikethrough | Completed tasks (all) + passed GCal items only |

No `NEEDS CLARIFICATION` items remain; all spec clarifications (Session 2026-06-02) are reflected above.
