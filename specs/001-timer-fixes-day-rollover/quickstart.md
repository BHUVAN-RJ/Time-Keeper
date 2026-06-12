# Quickstart: Timer Fixes & 4 AM Day Rollover

Manual verification guide for this feature. (No automated test runner is configured; use these steps plus `npm run typecheck` and `npm run lint`.)

## Prerequisites

```bash
cd web
npm install
# configure .env.local (see .env.example)
npm run db:generate   # after schema edits
npm run db:migrate
npm run dev
```

Quality gates:

```bash
npm run typecheck
npm run lint
```

## Scenario walkthroughs

### US1 — Timer never locks the app (P1)
1. Start a timer on Today.
2. While running, confirm the stop/label control is clickable and accepts input.
3. Simulate a long run / day crossing (see US2) and reopen the app; confirm it loads usable and the running block can be stopped.
- ✅ Expect: always able to stop & label; app never blocks (SC-001).

### US2 — 4 AM day boundary & silent auto-close (P1)
1. With a timer running, set the system/user clock just before 4:00 AM, then cross it (or invoke reconciliation by reloading Today after 4 AM).
2. Confirm: the running block is closed at 4:00 AM and a new running block resumes for the new day with the same Label/intent.
3. Confirm: the prior day is closed automatically (no prompt), `day_status.autoClosed = true`.
4. Record activity at ~1:00 AM and confirm it is attributed to the prior business day.
- ✅ Expect: no manual "Close all days"; no lost time (SC-002).

### US3 — Instant timer start (P1)
1. Throttle network (DevTools) and start a timer.
2. Confirm the timer/focus screen appears immediately (< 200 ms), before server confirmation.
3. Force a server failure and confirm a toast + recovery path with no lost time.
- ✅ Expect: instant transition (SC-003); graceful failure (FR-011).

### US4 — Edit a task (P2)
1. Create a task, open edit, change title/estimate/Label/dates, save.
2. Confirm changes persist everywhere; cancel leaves task unchanged.
- ✅ SC-004.

### US5 — Remaining tasks list (P2)
1. Create completed, dropped, today, future, and undated tasks.
2. Open the remaining list; confirm only open tasks show, ordered overdue/today → upcoming → undated.
3. Complete one; confirm it leaves the list.
- ✅ SC-005.

### US6 — Strikethrough (P2)
1. Complete a task → struck through.
2. Let a Google-Calendar item's day/week pass without completion → struck through.
3. Confirm a system task with a passed date is NOT struck through (rolls forward).
- ✅ SC-006.

### US7 — Good morning after 4 AM (P2)
1. After 4:00 AM, open the app first time that business day → good-morning screen appears.
2. Reopen later same day → does not reappear.
3. Confirm the optional reflective review for the last closed day is offered and is dismissible.
- ✅ SC-007.

### US8 — Single Label + analysis; tags gone (P3)
1. Confirm no tag UI/reporting anywhere (settings, pickers, stats/month) (SC-008).
2. Use the expandable Label picker; create a new Label inline → it gets neutral defaults.
3. Record time across Labels; open analysis → time per Label; totals reconcile (SC-009).

### US9 — Wasted time (P3)
1. In settings, set an active window (e.g., 10:00–22:00).
2. Record blocks covering part of the window.
3. Confirm uncovered in-window time = wasted; out-of-window time is not wasted; score reflects it.
4. Retroactively log a block over a gap → wasted decreases on recompute.
- ✅ SC-010; FR-026a/b.

## Migration verification

```bash
cd web
npm run db:generate   # expect: day_status.wasted_minutes, auto_closed; user_preferences.active_window_start/end
npm run db:migrate
```

Confirm existing rows get defaults (`wasted_minutes=0`, `auto_closed=0`, `active_window_start='09:00'`, `active_window_end='21:00'`).
