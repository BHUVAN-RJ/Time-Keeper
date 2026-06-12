# Feature Specification: Reactive UI & Async Data Sync

**Feature Branch**: `002-reactive-async-ui`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "Make the app more reactive and do async fetch from the database instead of making the UI wait after every action. Detach slow DB operations from deterministic UI actions (tab switch, button click). Example: adding a task should appear instantly on the current device, then sync to the database. Tab switches should load instantly and populate results after."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant Task Mutations (Priority: P1)

As a user managing tasks, when I create, complete, edit, schedule, or drop a task, the change appears immediately in the list I am viewing without waiting for the server round-trip. The form clears or the card updates right away; database sync happens in the background.

**Why this priority**: Task management is the most frequent interaction after the timer and currently blocks on `router.refresh()` after every action.

**Independent Test**: Create a task on the Tasks page with network throttled — the new card appears in < 100 ms; the submit button is not disabled for the full server duration.

**Acceptance Scenarios**:

1. **Given** I am on the Tasks tab with Today selected, **When** I submit a new task, **Then** the task card appears in the appropriate list immediately and the form resets without a full-page reload.
2. **Given** a task card is visible, **When** I tap Done, **Then** the card shows completed styling (strikethrough) immediately while sync runs in the background.
3. **Given** the server rejects a mutation (validation error, network failure), **When** background sync fails, **Then** the optimistic change is rolled back and a toast explains the error.

---

### User Story 2 - Instant In-Page Tab Switching (Priority: P1)

As a user on the Tasks page (Today / Remaining / Backlog / Matrix) or Tasks hub (Tasks / Habits / Projects), when I switch tabs the UI updates instantly. If data for that view is not yet cached, a lightweight loading state appears inside the panel while data loads asynchronously — the shell and tab highlight never block.

**Why this priority**: Tab switches feel sluggish when tied to server revalidation or full data reloads.

**Independent Test**: Switch between Today and Backlog tabs — tab highlight changes in < 50 ms; list content may skeleton-load but the page does not flash or freeze.

**Acceptance Scenarios**:

1. **Given** I am on Tasks → Today, **When** I click Backlog, **Then** the Backlog tab is active immediately and the backlog list renders from cache or shows an inline skeleton while fetching.
2. **Given** I am on the Tasks hub, **When** I switch from Tasks to Habits, **Then** the Habits panel mounts instantly without a full route navigation wait.
3. **Given** cached data exists for a tab, **When** I return to that tab, **Then** cached content shows immediately (stale-while-revalidate).

---

### User Story 3 - Instant Route Navigation (Priority: P2)

As a user navigating between main app sections (Today, Week, Tasks, Stats, Settings), the destination shell appears immediately. Data populates after navigation without blocking interaction with chrome (nav, layout).

**Why this priority**: App Router server components currently await all data before paint on several pages.

**Independent Test**: Navigate from Today to Stats — layout and page title appear immediately; charts/widgets fill in within one network round-trip.

**Acceptance Scenarios**:

1. **Given** I tap Stats in the nav, **When** the route changes, **Then** I see the Stats page shell (title, layout) before stats data resolves.
2. **Given** I tap Today while already on Today, **When** I want a refresh, **Then** data revalidates in the background without a blocking white flash.

---

### User Story 4 - Reactive Timer & Today Dashboard (Priority: P2)

As a user on the Today page, starting/stopping/editing time blocks, habits, and pinned items feels instant. The existing optimistic timer start pattern is extended consistently to stop, manual entry, delete, and related panels.

**Why this priority**: Today already has partial optimistic support; gaps (stop, manual block, habits) still wait on server + invalidate.

**Independent Test**: Stop a running timer — the running state clears immediately; block appears in the list after sync.

**Acceptance Scenarios**:

1. **Given** a timer is running, **When** I stop it, **Then** the running UI clears immediately and the completed block appears in the list optimistically.
2. **Given** I toggle a habit, **When** I tap the checkbox, **Then** it toggles immediately and syncs in the background.

---

### User Story 5 - Reactive Settings & Secondary Surfaces (Priority: P3)

As a user editing categories/labels, projects, habits, reminders, and settings, saves apply optimistically or show inline pending state without disabling the entire form until the server responds.

**Why this priority**: Lower traffic than tasks/today but same UX principle.

**Independent Test**: Rename a label — the name updates in the list immediately.

**Acceptance Scenarios**:

1. **Given** I edit a category name, **When** I save, **Then** the list reflects the new name immediately.
2. **Given** I create a project, **When** I submit, **Then** it appears in the project list and picker without `router.refresh()`.

---

### Edge Cases

- What happens when two tabs/devices mutate the same entity? Server wins on reconcile; client shows latest after invalidation/poll.
- What happens when optimistic temp IDs are replaced by server IDs? UI swaps temp id for real id without flicker.
- What happens on offline / failed sync? Roll back optimistic state; show retry toast; do not leave phantom items permanently.
- What happens when user rapidly clicks Done twice? Idempotent server actions + client dedupes in-flight mutations.
- What happens when tab data is stale? Background refetch updates list without jarring full reload.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All task mutations (create, update, complete, drop, schedule-for-today) MUST update the visible UI before the server action resolves.
- **FR-002**: Task list data MUST be managed via client cache (`@tanstack/react-query`) with optimistic updates and background reconciliation — not `router.refresh()` as the primary refresh mechanism.
- **FR-003**: In-page tab switches (Tasks sub-tabs, Tasks hub views) MUST not await server round-trips; they MUST switch UI state synchronously.
- **FR-004**: Tab/view data SHOULD use cached queries with `placeholderData` / `initialData` from SSR where available, and fetch on demand when a tab is first opened.
- **FR-005**: Route navigations SHOULD show page shells via Next.js `loading.tsx` or client-side query loading states; heavy server awaits MUST NOT block first paint of layout chrome.
- **FR-006**: Failed optimistic mutations MUST roll back client cache to the prior snapshot and surface a user-visible error.
- **FR-007**: Successful mutations MUST reconcile client cache with server response (replace temp ids, merge authoritative fields).
- **FR-008**: Today timer stop, manual block create/edit/delete, and habit toggles MUST follow the same optimistic-then-sync pattern already used for timer start.
- **FR-009**: Categories, projects, habits management pages MUST migrate off `router.refresh()` to mutation + cache invalidation or optimistic update.
- **FR-010**: Server actions MAY retain `revalidatePath` for SSR cache coherence but clients MUST NOT depend on full page revalidation for interactivity.
- **FR-011**: Buttons MUST NOT be globally disabled for the entire duration of background sync except where duplicate submission would cause data corruption (e.g., double timer start) — use per-action in-flight tracking instead.
- **FR-012**: A shared mutation helper pattern MUST be established so new features follow the same optimistic-update contract.

### Key Entities *(include if feature involves data)*

- **Client cache entry**: Query key + data snapshot for a page or tab slice (tasks lists, today dashboard, habits, projects).
- **Optimistic mutation**: Pending local change with optional `tempId`, `previousSnapshot` for rollback, and `status` (pending | synced | failed).
- **Tab/view descriptor**: Identifies which query keys a tab needs so switching tabs triggers fetch only for missing keys.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Task create → visible in list in < 100 ms on a mid-range device (measured without network throttle for local state update).
- **SC-002**: Tab switch → active tab highlight in < 50 ms; no full-page loading spinner.
- **SC-003**: 95% of mutations do not call `router.refresh()` (measured by grep/audit of client components after migration).
- **SC-004**: Failed mutation rollback restores prior UI state within 500 ms of server error.
- **SC-005**: Today timer stop clears running state in < 200 ms (consistent with existing timer start SC from feature 001).

## Assumptions

- Existing server actions remain the persistence layer; no new REST API is required.
- Single-user-per-session concurrency is sufficient; last-write-wins on reconcile is acceptable.
- React Query is the standard client cache (already in `providers.tsx`); Zustand may hold ephemeral UI-only state (focus session) but not duplicate entity caches.
- SSR initial data continues to hydrate queries via `initialData` to avoid empty first paint on hard reload.
- Automated test framework is still out of scope; verification via manual quickstart + typecheck/lint.
