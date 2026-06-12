# Contract: Labels (merged from Categories) & Tag Removal

Server actions in `web/src/actions/categories.ts` (Label management) and the expandable picker component. Analysis in `stats.ts` / `month.ts`.

## Label = Category (UI-renamed)

- The `categories` table backs **Labels**. All user-facing strings say "Label". Existing management screen (`/categories`) becomes Label management.

## `createLabelInline(name)` — NEW (or extend create-category action)

- **Input**: `name: string` (non-empty, unique per user).
- **Behavior**: insert a Label with **neutral defaults** — `baseCreditRate = NEUTRAL_RATE`, auto-assigned `color`, `isFreeTime = false`, no `schedule_goals` row.
- **Output**: `{ ok: true, label: { id, name, color } }`.
- **Acceptance ↔ FR**: FR-022, FR-022a.

## Expandable Label picker (component contract)

- Replaces the plain category `<select>` in start/stop/manual-block/task-create.
- Lists existing (non-archived) Labels; supports inline create via `createLabelInline`.
- Single selection; the selected Label is the block/task classification.
- **Acceptance ↔ FR**: FR-021, FR-022.

## Per-Label analysis

- **Output**: total time per Label over a selected period (sum of block durations grouped by `categoryId`), surfaced on the stats page.
- Sum of per-Label time equals total recorded time for the period within rounding (SC-009).
- **Acceptance ↔ FR**: FR-023; SC-009.

## Tag removal

- Remove `tag-picker.tsx`, `tags-settings.tsx`, tag inputs in stop/manual/task-create, and tag breakdown in month/stats.
- Stop reading/writing `tagsEnabled`. Tag tables left unused (R6).
- **Result**: no tag UI/reporting anywhere (FR-020; SC-008).
