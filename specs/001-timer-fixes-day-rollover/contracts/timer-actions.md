# Contract: Timer Actions (optimistic start, stop, split)

Server actions in `web/src/actions/time-blocks.ts`. All actions are authenticated (current user from session). Return shape uses the existing `{ ok: boolean; ... }` convention.

## `startBlockAction(categoryId, taskId?, statedIntent?)`

**Behavior change**: The server action itself stays authoritative, but the **client** (`today-client.tsx`) MUST start optimistically (see Optimistic Start Contract) and call this in the background.

- **Input**: `categoryId: string` (Label id, required), `taskId?: string | null`, `statedIntent?: string | null`.
- **Output (success)**: `{ ok: true, block: { id, startAt, categoryId, statedIntent, taskId, projectId } }` — returns the persisted block so the client can reconcile the optimistic id.
- **Output (conflict)**: `{ ok: false, reason: 'already_running', runningBlockId: string }` when the single-running-block unique index would be violated.
- **Errors**: invalid/foreign `categoryId` → `{ ok: false, reason: 'invalid_label' }`.
- **Invariant**: at most one running block per user (DB partial unique index).

## Optimistic Start Contract (client, `today-client.tsx`)

1. On click: synchronously insert an optimistic running block into the `["today"]` react-query cache and transition to focus view (< 200 ms, no `await`).
2. Call `startBlockAction(...)` in the background.
3. **On success**: replace optimistic block id with `block.id` in cache; no visible change.
4. **On `already_running`**: roll back optimistic block; toast; offer "view/stop running block" recovery; do not lose user input.
5. **On other failure**: roll back; toast error with retry.

**Acceptance ↔ FR**: FR-009, FR-010, FR-011; SC-003.

## `stopBlockAction(blockId, { label?, categoryId, quality, projectId?, notes? })`

- **Behavior change**: A separate free-text `label` is **no longer required**. Classification = `categoryId` (Label). `label` is optional/deprecated input retained for compatibility; UI does not present it as a separate field.
- **Input**: `blockId: string`, `categoryId: string` (Label), `quality: 'useful'|'chores'|'meh'|'wasted'`, optional `projectId`, `notes`.
- **Output**: `{ ok: true }` and the block is finalized (`endAt = now`).
- **Reachability requirement**: the control that triggers this MUST always be interactive while a block runs (FR-001). A recovery/force-stop path MUST exist (FR-002, FR-003).
- **Acceptance ↔ FR**: FR-001, FR-002, FR-003; SC-001.

## `splitRunningBlockAtBoundary(userId, boundaryUtc)` (internal, invoked by reconciliation)

- **Input**: the running block + the crossed boundary instant(s).
- **Behavior**: set running block `endAt = boundaryUtc`; insert one fresh running block for the current business day carrying `categoryId`, `statedIntent`, `projectId`, `taskId`. For multiple crossed boundaries, create closed segments per intermediate day and a single running block for today. Transactional; honors the running-block unique index.
- **Acceptance ↔ FR**: FR-007; SC-002.
