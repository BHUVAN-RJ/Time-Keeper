# Implementation Plan: Reactive UI & Async Data Sync

**Branch**: `002-reactive-async-ui` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-reactive-async-ui/spec.md`

## Summary

Time-Keeper currently mixes two data-fetch patterns: **React Query** (Today, Week, Projects, Month recap) and **`router.refresh()` + blocking `pending` state** (Tasks, Habits, Categories, and several modals). The result is that task creation, tab interactions tied to revalidation, and many button clicks wait for a full server round-trip before the UI updates.

This feature standardizes on **optimistic client cache + background server sync** across all high-traffic surfaces. User actions update local React Query cache immediately; server actions persist asynchronously; failures roll back and toast. In-page tabs switch synchronously and load tab-specific data via lazy queries with SSR `initialData` hydration. Route navigations use `loading.tsx` shells where missing so chrome paints before data resolves.

The technical approach extends the existing pattern in `today-client.tsx` (optimistic timer start) and `projects-client.tsx` / `week-client.tsx` (useQuery fetch) into a shared `lib/mutations/` helper and per-domain query modules under `lib/queries/`.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 22

**Primary Dependencies**: Next.js 16.2.6 (App Router, Server Actions), React 19.2, `@tanstack/react-query` 5.100, Drizzle ORM 0.45 on libSQL/SQLite, next-auth 5, Zustand 5 (ephemeral UI only), date-fns-tz 3, Tailwind v4

**Storage**: libSQL / SQLite via Drizzle — unchanged; server actions remain persistence boundary

**Testing**: No automated test runner. Quality gates: `npm run typecheck`, `npm run lint`. Manual verification via `quickstart.md`.

**Target Platform**: Modern browsers (PWA); serverless deployment

**Project Type**: Single full-stack Next.js app under `web/`

**Performance Goals**: Task create visible < 100 ms (SC-001); tab switch highlight < 50 ms (SC-002); timer stop clears running state < 200 ms (SC-005)

**Constraints**: Must preserve server-side invariants (single running block, auth scoping). Optimistic temp IDs must reconcile with server IDs. `revalidatePath` may remain in server actions for SSR cache but clients must not depend on it for interactivity.

**Scale/Scope**: ~15 client components currently using `router.refresh()`; 4 already on React Query. Migration is incremental by surface priority (Tasks → Today gaps → Habits/Categories → modals/settings).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an **unpopulated template** — no ratified gates.

- **Initial gate (pre-Phase 0)**: PASS (vacuously).
- **Post-design re-check**: PASS — no new services; complexity localized to client cache layer and component refactors; reuses existing stack.

No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-reactive-async-ui/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── optimistic-mutations.md
│   ├── tasks-cache.md
│   ├── today-cache.md
│   └── navigation-loading.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
web/
├── src/
│   ├── lib/
│   │   ├── queries/                    # NEW — query keys + fetch fns
│   │   │   ├── tasks.ts
│   │   │   ├── habits.ts
│   │   │   ├── categories.ts
│   │   │   └── keys.ts                 # centralized query key factory
│   │   └── mutations/                  # NEW — optimistic mutation helpers
│   │       └── optimistic.ts
│   ├── components/
│   │   ├── tasks-client.tsx            # REFACTOR — useQuery + useMutation
│   │   ├── tasks-hub-client.tsx        # REFACTOR — instant view switch, lazy habits data
│   │   ├── habits-client.tsx           # REFACTOR — useQuery + optimistic create/update
│   │   ├── categories-client.tsx       # REFACTOR
│   │   ├── projects-client.tsx         # ENHANCE — optimistic create/complete
│   │   ├── today-client.tsx            # ENHANCE — optimistic stop/manual/delete
│   │   ├── today-habits-panel.tsx      # ENHANCE — optimistic habit toggle
│   │   ├── app-nav.tsx                 # REFACTOR — background invalidate vs refresh
│   │   └── (other *-client.tsx)        # AUDIT — replace router.refresh where applicable
│   └── app/(app)/
│       ├── tasks/page.tsx              # SLIM — pass SSR initialData only
│       ├── stats/loading.tsx           # NEW
│       ├── week/loading.tsx            # NEW (week has error.tsx, add loading)
│       ├── tasks/loading.tsx           # NEW
│       └── settings/loading.tsx        # NEW
└── package.json
```

**Structure Decision**: All changes stay within `web/`. New `lib/queries/` and `lib/mutations/` provide shared contracts; components migrate incrementally. No API route layer added — server actions invoked from `useMutation` mutationFns.

## Complexity Tracking

> No constitution violations; section intentionally empty.

## Migration Phases (implementation order)

### Phase A — Foundation (P1 infrastructure)

1. Add `lib/queries/keys.ts` — typed query key factory.
2. Add `lib/mutations/optimistic.ts` — `onMutate` snapshot/rollback wrapper.
3. Configure `QueryClient` defaults in `providers.tsx` (`staleTime`, `gcTime`, `retry`).

### Phase B — Tasks (P1 user story)

1. Split `getTasksPageData()` into slice fetchers or expose tab-keyed queries.
2. Refactor `tasks-client.tsx` to `useQuery(["tasks", tab])` with full page `initialData`.
3. Replace `router.refresh()` with `useMutation` + optimistic list updates for create/complete/drop/schedule/edit.
4. `TaskCard` — remove global `busy` lock; use per-mutation pending overlay or disable single button.

### Phase C — Tabs & Hub (P1 user story)

1. `tasks-hub-client.tsx` — switch views via local state (not `router.push` for habits/projects); sync URL with `history.replaceState` or shallow routing.
2. Lazy-fetch habits data on first Habits view open if not in cache.
3. Tasks sub-tabs already client-side — ensure each tab slice has independent query or derived from parent cache.

### Phase D — Today gaps (P2)

1. Optimistic `stopBlockAction`, `createManualBlockAction`, `deleteBlockAction`, `updateBlockAction`.
2. `today-habits-panel.tsx` — optimistic habit log toggle.
3. Replace `invalidateQueries` + await with fire-and-forget invalidation where optimistic state is sufficient.

### Phase E — Secondary surfaces (P3)

1. Habits, Categories, Reminders, Settings — migrate to useQuery + optimistic mutations.
2. Modals (end-day, am-rundown) — keep blocking only where server response drives branching; otherwise optimistic + background.
3. Add `loading.tsx` for Stats, Week, Tasks, Settings routes.
4. `app-nav.tsx` — Today re-tap triggers `queryClient.invalidateQueries` instead of `router.refresh()`.

### Phase F — Audit

1. Grep for remaining `router.refresh()` in `web/src/components` — target zero except justified cases (auth redirect).
2. Document exceptions in `quickstart.md`.
