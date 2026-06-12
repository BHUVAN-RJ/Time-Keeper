# Research: Reactive UI & Async Data Sync

**Feature**: `002-reactive-async-ui` | **Date**: 2026-06-11

## R1 — Client cache library choice

**Decision**: Standardize on `@tanstack/react-query` v5 (already installed and used in Today, Week, Projects, Month).

**Rationale**: Already in `providers.tsx`; `today-client.tsx` demonstrates optimistic `setQueryData` + `invalidateQueries`; `week-client.tsx` and `projects-client.tsx` show `useQuery` fetch patterns. Adding a second cache (e.g., Zustand for entity data) would duplicate state and complicate rollback.

**Alternatives considered**:
- **Zustand for all entity state** — rejected; would require manual sync with server and duplicate Today's query logic.
- **SWR** — rejected; would add a second fetch library.
- **Next.js `useOptimistic` alone** — insufficient for cross-component cache (task appears in multiple tabs); React Query covers broader needs.

---

## R2 — Optimistic update pattern

**Decision**: Use `useMutation` with a shared helper wrapping `onMutate` (snapshot prior cache) → `onError` (rollback) → `onSettled` (invalidate or merge server response).

**Rationale**: TanStack Query v5 docs recommend this triad for optimistic updates. Matches existing timer start in `today-client.tsx` (manual `qc.setQueryData` + rollback on error).

**Alternatives considered**:
- **Fire-and-forget server action without optimistic UI** — rejected; fails SC-001/SC-002.
- **Full offline queue (IndexedDB)** — rejected; out of scope; rollback + toast sufficient for v1.

---

## R3 — Temp ID strategy for creates

**Decision**: Generate client-side `tempId` prefix (`temp_${crypto.randomUUID()}`) for optimistic inserts; replace with server-returned `id` in `onSuccess` or after extending server actions to `returning({ id })`.

**Rationale**: `createTaskAction` currently returns void — must be extended to return `{ id }` (already done for `startBlockAction`). UI lists key by `id`; swap must be atomic in cache update.

**Alternatives considered**:
- **Wait for server id before showing** — rejected; violates instant display requirement.
- **Negative integer temp ids** — rejected; string prefix is clearer and avoids collision with UUIDs.

---

## R4 — Tab switching without route navigation

**Decision**: Tasks hub (Tasks/Habits/Projects) uses **local view state** for instant switch; URL updated via `window.history.replaceState` or Next.js `router.replace` with `{ scroll: false }` without awaiting RSC payload. Tasks sub-tabs remain pure `useState`.

**Rationale**: Current `tasks-hub-client.tsx` calls `router.push` on view change, which can trigger RSC re-fetch on some Next versions. Local state + optional shallow URL sync gives instant UX.

**Alternatives considered**:
- **Parallel routes / `@modal` slots** — over-engineered for three views already on one page.
- **Keep router.push** — rejected; user explicitly wants instant tab switch.

---

## R5 — SSR hydration strategy

**Decision**: Server pages continue fetching initial data; pass as `initialData` to `useQuery` with `staleTime: 30_000` (or similar) so hard reload is not empty, but subsequent mutations do not trigger full RSC refresh.

**Rationale**: `today-client.tsx` already uses `useQuery({ queryKey: ["today"], queryFn: getTodayData, initialData: initial })`. Same pattern for tasks page.

**Alternatives considered**:
- **Client-only fetch (no SSR data)** — rejected; worse first paint on slow networks.
- **Keep server await blocking entire page** — rejected; add `loading.tsx` for route shell.

---

## R6 — `router.refresh()` vs `invalidateQueries`

**Decision**: Replace `router.refresh()` in client components with targeted `queryClient.invalidateQueries({ queryKey })` or optimistic `setQueryData`. Retain `revalidatePath` in server actions for any remaining RSC-only pages.

**Rationale**: Audit found 14 `router.refresh()` call sites in components. `router.refresh()` re-runs all server components on the page — expensive and blocks perceived interactivity.

**Alternatives considered**:
- **Remove all `revalidatePath` from server actions** — rejected; may break non-migrated RSC pages; safe to keep both during migration.

---

## R7 — Button disabled / pending UX

**Decision**: Remove page-level `pending`/`busy` that disables all actions. Use per-mutation `isPending` on the specific button, or allow rapid clicks with idempotent server actions.

**Rationale**: User requirement: "detach functions that take long from deterministic actions." Global `setPending(true)` on task create blocks the whole form unnecessarily after local optimistic insert.

**Alternatives considered**:
- **Keep disabled buttons until server confirms** — rejected; contradicts spec FR-011.

---

## R8 — Route loading shells

**Decision**: Add `loading.tsx` using existing `PageLoadingShell` for Tasks, Stats, Week, Settings (Today already has one).

**Rationale**: Only `today/loading.tsx` exists today. App Router shows loading UI instantly on navigation when `loading.tsx` is present.

**Alternatives considered**:
- **Client-only loading in each *-client.tsx** — acceptable as supplement but does not help RSC await on first paint; both used together.

---

## R9 — Cross-tab cache consistency

**Decision**: Single `["tasks"]` parent query or normalized cache; tab slices derived via `select` or separate keys invalidated together on mutation (`queryClient.invalidateQueries({ queryKey: ["tasks"] })`).

**Rationale**: Creating a task may appear in Today, Backlog, and Matrix simultaneously. One mutation must update all relevant slices.

**Alternatives considered**:
- **Independent per-tab queries without shared invalidation** — rejected; causes stale lists after create.
