# Quickstart: Reactive UI & Async Data Sync

Manual verification checklist for feature `002-reactive-async-ui`.

**Prereqs**: `cd web && npm run dev`; logged-in user with sample tasks.

**Quality gates** (after implementation):

```bash
cd web && npm run typecheck && npm run lint
```

---

## 1. Task create — instant display (SC-001)

1. Open `/tasks`.
2. Open DevTools → Network → throttle "Slow 3G".
3. Enter title "Optimistic test", estimate 15, submit.
4. **Expect**: Card appears in list within ~100 ms; form clears; button not blocked for full round-trip.
5. **Expect**: After network completes, task persists on hard refresh.

## 2. Task complete — instant strikethrough

1. On Today tab, tap **Done** on a task.
2. **Expect**: Strikethrough immediately; toast after server (score toast if applicable).
3. Throttle network; **Expect**: UI still updates instantly; rollback + error toast if server fails.

## 3. Tab switch — instant highlight (SC-002)

1. On Tasks page, click **Backlog** → **Matrix** → **Today** rapidly.
2. **Expect**: Tab highlight switches with no full-page spinner.
3. **Expect**: Lists render from cache; no white flash.

## 4. Tasks hub view switch

1. On `/tasks`, click **Habits** then **Projects** then **Tasks**.
2. **Expect**: Panel switches instantly each time.
3. **Expect**: URL updates (`?view=habits`) without navigation freeze.

## 5. Today timer stop (SC-005)

1. Start a timer on `/today`.
2. Open stop dialog, fill label, confirm stop.
3. **Expect**: Running UI clears immediately (< 200 ms).
4. **Expect**: Block appears in today's list; lucky bonus toast if applicable.

## 6. Today re-tap refresh

1. On `/today`, tap **Today** in nav again.
2. **Expect**: Data refetches in background without full page reload flash.

## 7. Route navigation shells

1. Navigate Today → Stats → Week → Tasks.
2. **Expect**: Each route shows `PageLoadingShell` briefly, not blank screen.

## 8. Failure rollback (SC-004)

1. Simulate failure (e.g., disconnect network mid-mutation).
2. Create a task or complete one.
3. **Expect**: Optimistic change reverts; error toast within ~500 ms.

## 9. Audit — no router.refresh in components

```bash
rg 'router\.refresh' web/src/components
```

**Expect**: Zero matches. All client components now use `queryClient.invalidateQueries` or optimistic `setQueryData` instead of full RSC refresh.

## 10. Cross-surface consistency

1. Create task scheduled for today on Tasks page.
2. Navigate to `/today` without manual refresh.
3. **Expect**: Task appears (via shared cache invalidation or today query).
