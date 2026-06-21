# Time Keeper — web app

Next.js 16 app in this folder. Product spec: repo root [`spec_v4.md`](../spec_v4.md). Latest feature record: [`specs/003-rewards-sync-shop/implementation-record.md`](../specs/003-rewards-sync-shop/implementation-record.md). Design tokens: `src/styles/design-tokens.ts`.

## Setup

1. Copy `.env.example` to `.env.local` and fill values (see `tech_setup_v2.md` at repo root).
2. Install deps: `npm ci`
3. Apply DB migrations to your Turso database:

```bash
source .env.local   # load TURSO_* vars
npm run db:migrate
```

Current head migration: **`0016_early_grim_reaper`** (allocation columns + shop tables). See [`specs/003-rewards-sync-shop/implementation-record.md`](../specs/003-rewards-sync-shop/implementation-record.md) for deploy notes.

4. Dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to sign-in or Today.

## Main routes

| Route | Purpose |
|-------|---------|
| `/today` | Timer, blocks, AM rundown, pinned top-3, habits |
| `/week` | Weekly view + rundown |
| `/tasks` | Task backlog and scheduling |
| `/habits` | Habit management |
| `/projects` | Projects |
| `/stats` | Credits, score, history |
| `/shop` | Symbolic point redemptions |
| `/categories` | Category CRUD (includes archived) |
| `/settings` | Preferences |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local dev |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Regenerate Drizzle SQL from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to the DB pointed to by env |

## Deploy (Vercel)

- Set **Root Directory** to `web`.
- Add the same environment variables as `.env.local`.
- Set `AUTH_URL` to your production URL exactly (`https://…`).
- Run `npm run db:migrate` against production **after** deploy when schema changes (see `tech_setup_v2.md` §5.3).

## PWA

- `public/manifest.json` + `public/sw.js` + dynamic `/icon` route.
- iOS: Safari → Share → Add to Home Screen.
