# Contract: Task Actions (edit, remaining list, strikethrough)

Server actions in `web/src/actions/tasks.ts`; presentation in `tasks-client.tsx`, panels, and `calendar-events-list.tsx`.

## `updateTaskAction(taskId, fields)` — NEW

- **Input**: `taskId: string`, `fields: { title?, estimateMinutes?, categoryId?, projectId?, dueDate?, scheduledDate?, description? }` (partial; only provided fields change).
- **Output**: `{ ok: true, task }` or `{ ok: false, reason }`.
- **Rules**: `title` non-empty if provided; `estimateMinutes` ≥ 0; `categoryId`/`projectId` must reference the user's Labels/projects; updates `updatedAt`.
- **Persistence/visibility**: changes reflected wherever the task appears (FR-013).
- **Cancel**: a cancelled edit (client-side) persists nothing (Acceptance scenario US4-2).
- **Acceptance ↔ FR**: FR-012, FR-013; SC-004.

## `getRemainingTasks()` (or extend Today/tasks data) — NEW query

- **Output**: all tasks where `status NOT IN ('completed','dropped')`, regardless of date, ordered:
  1. Overdue/today (scheduled/due ≤ today business day),
  2. Upcoming (future-dated),
  3. Undated backlog.
- **Reactivity**: completing/dropping a task removes it from the list (FR-015).
- **Acceptance ↔ FR**: FR-014, FR-014a, FR-015; SC-005.

## Strikethrough (presentation contract)

- **Completed tasks (all sources)**: render with strikethrough when `status = 'completed'` (FR-016; SC-006).
- **Passed Google-Calendar items**: in `calendar-events-list.tsx`, render strikethrough for GCal-sourced items whose scheduled day/week (business-day based) is past and not completed (FR-017).
- **System-defined tasks**: NOT struck through for a passed date; retain current roll-forward behavior (FR-017, US6 scenario 3).
