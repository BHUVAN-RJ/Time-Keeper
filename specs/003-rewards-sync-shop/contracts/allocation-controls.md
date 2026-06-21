# Contract: Allocation Controls

Dual-dropdown allocation for time blocks. Component: `web/src/components/allocation-picker.tsx`.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `"project" \| "habit" \| "task" \| null` | yes | First dropdown value |
| `entityId` | `string \| null` | yes | Second dropdown value |
| `onChange` | `(type, entityId) => void` | yes | Emits mutual-exclusive selection |
| `projects` | `{ id, name }[]` | yes | Active projects |
| `habits` | `{ id, name }[]` | yes | Active habits |
| `tasks` | `{ id, title }[]` | yes | Open tasks (not completed/dropped) |
| `disabled?` | `boolean` | no | During pending mutation |

## Behavior

1. Changing **type** clears `entityId` and clears unrelated FKs in parent state.
2. Second dropdown options filtered by `type`; hidden/disabled when `type` is null.
3. Empty list shows: "No {type}s yet — create one in Tasks/Habits/Projects."
4. On save (parent responsibility), pass exactly one of:

```ts
{ projectId: string | null; habitId: string | null; taskId: string | null }
```

## Server action inputs (extended)

### `stopBlockAction`

```ts
{
  blockId: string;
  categoryId: string;
  label?: string;
  quality: Quality;
  projectId?: string | null;
  habitId?: string | null;
  taskId?: string | null;
  // habitId and taskId are new; only one allocation FK allowed
}
```

### `startBlockAction`

```ts
(categoryId, taskId?, statedIntent?, focusTargetMinutes?)
```

### `createManualBlockAction` / `updateBlockAction`

Same allocation triple; validate mutual exclusion server-side.

## Validation (server)

- If more than one allocation FK set → `throw new Error("Only one allocation target allowed")`.
- `habitId` / `taskId` / `projectId` must belong to `userId` and be active/open.
- On stop with `habitId`: trigger habit auto-complete (see `credits-bonuses.md`).
