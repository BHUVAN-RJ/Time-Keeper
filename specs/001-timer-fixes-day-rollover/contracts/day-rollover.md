# Contract: Day Rollover & Silent Auto-Close

Shared helpers in `web/src/lib/day-boundary.ts` and reconciliation in `web/src/actions/day-status.ts` / `end-day.ts`.

## `businessDayInTz(now: Date, tz: string): string`

- **Output**: `YYYY-MM-DD` for the 4 AM-based business day. Times 00:00–03:59 local map to the previous date.
- **Pure/deterministic**; DST-correct (offset applied in zoned time).

## `getBusinessDayRangeUtc(now: Date, tz: string): { startUtc: Date; endUtc: Date }`

- **Output**: `[local 04:00 of business day, local 04:00 next day)` as UTC instants.

## `reconcileDayRollover(userId: string, now: Date): Promise<void>`

Invoked at the start of: Today data load, AM rundown load, and timer start/stop actions. Idempotent.

- **Steps**:
  1. Compute current business day.
  2. If a running block started before today's business-day start → `splitRunningBlockAtBoundary` (see timer-actions).
  3. For each business day `< today` with activity and `day_status.endedAt IS NULL` (oldest-first), run **silent auto-close**.
- **Concurrency**: safe under concurrent calls (upserts keyed by `userId+date`).
- **Acceptance ↔ FR**: FR-004, FR-005, FR-006, FR-008; SC-002.

## Silent auto-close (per day)

- **Behavior**: compute and persist day metrics + `productivityScore` (including derived `wastedMinutes`), roll **incomplete system tasks** forward (existing roll-forward behavior), set `day_status.endedAt = now`, `autoClosed = true`. **Does NOT** require or prompt mood/notes/plan.
- **Optional review**: the reflective review for the most-recently-closed day is offered later via the good-morning screen (non-blocking).
- **Acceptance ↔ FR**: FR-006, FR-006a.

## Removed / changed

- The manual "Close all days" batch action is **removed from the normal flow** (FR-008). A manual catch-up MAY remain for long absences but is not required.
