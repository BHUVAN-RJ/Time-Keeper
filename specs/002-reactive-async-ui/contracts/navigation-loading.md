# Contract: Navigation & Loading UX

## Route-level loading shells

Add `loading.tsx` next to `page.tsx` for:

| Route | File | Shell |
|-------|------|-------|
| `/tasks` | `web/src/app/(app)/tasks/loading.tsx` | `PageLoadingShell title="Tasks"` |
| `/stats` | `web/src/app/(app)/stats/loading.tsx` | `PageLoadingShell title="Stats"` |
| `/week` | `web/src/app/(app)/week/loading.tsx` | `PageLoadingShell title="Week"` |
| `/settings` | `web/src/app/(app)/settings/loading.tsx` | `PageLoadingShell title="Settings"` |
| `/today` | exists | no change |

**Behavior**: On navigation, App Router shows shell within one frame; RSC data loads in parallel.

## In-page tab switching

### Tasks sub-tabs (`TaskTabs`)

- `onTab(next)` → `setTab(next)` synchronously
- No fetch on switch (data preloaded in `["tasks"]`)
- Optional: subtle `isFetching` indicator in tab bar during background refetch

### Tasks hub views

- `setView(next)` → local state first
- `router.replace` for URL only (non-blocking)
- Habits/Projects panels use own `useQuery` with `enabled: view === 'habits'` pattern OR mount when first visited

## App nav (`app-nav.tsx`)

### Today re-tap (already on Today)

**Current**: `router.refresh()`  
**New**: `queryClient.invalidateQueries({ queryKey: ["today"] })` — no full RSC refresh

### Other nav links

Standard `<Link>` — rely on `loading.tsx` for destination shell.

## `router.refresh()` audit exceptions

Allowed after migration:

| Location | Reason |
|----------|--------|
| Auth redirect flows | Session change requires full RSC |
| `calendar-poll-provider` | Optional — may switch to invalidate calendar slice only |

All other component-level `router.refresh()` **MUST** be removed or replaced (SC-003).

## QueryClient defaults (`providers.tsx`)

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
```
