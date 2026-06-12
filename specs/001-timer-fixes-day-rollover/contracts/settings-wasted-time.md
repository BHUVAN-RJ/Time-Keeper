# Contract: Active Window Settings & Wasted Time

Settings actions in `web/src/actions/preferences.ts`; computation in `web/src/lib/wasted-time.ts`; UI in `settings-client.tsx`; scoring in `productivity-scores.ts`.

## `setActiveWindowAction(start, end)` — NEW

- **Input**: `start: string`, `end: string` — `HH:MM` (24h), validated against `^([01]\d|2[0-3]):[0-5]\d$`.
- **Behavior**: upsert `user_preferences.activeWindowStart/End` for the user.
- **Output**: `{ ok: true }` or `{ ok: false, reason: 'invalid_time' }`.
- **Default**: if never set, the app uses `09:00`–`21:00` (schema default) (FR-027).
- **Acceptance ↔ FR**: FR-024, FR-027.

## `computeWastedMinutes(businessDay, blocks, window, tz)` — NEW (pure)

- **Inputs**: business-day range, the day's recorded blocks, active window (`HH:MM` start/end), timezone.
- **Algorithm**:
  1. Resolve the active window to UTC instants within the business day (clamp; support window crossing midnight).
  2. Compute the union of recorded block intervals, clipped to the window.
  3. `wasted = (window minutes) − (covered-in-window minutes)`.
- **Output**: integer minutes ≥ 0.
- **Rules**:
  - Time outside the window is never wasted (FR-026).
  - No "wasted" blocks are materialized; value is derived (FR-026a).
  - Retroactively adding a block over a gap reduces wasted minutes on recompute (FR-026a).
- **Acceptance ↔ FR**: FR-025, FR-026, FR-026a; SC-010.

## Scoring integration

- Wasted minutes count against the day's productivity score as uncredited time (FR-026b). On day close, persist to `day_status.wastedMinutes`; for the open day, compute live.

## Settings UI

- Add active-window start/end controls in `settings-client.tsx`.
- Remove the tags on/off toggle (R6).
