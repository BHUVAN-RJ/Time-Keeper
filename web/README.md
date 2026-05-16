# Time Keeper — web app (v0.1)

Next.js 16 app in this folder. Product spec: repo root `spec_v4.md`. Phase checklist: `docs/v0.1-phase.md`. Design tokens: `docs/design.md` and `src/styles/design-tokens.ts`.

## Setup

1. Copy `.env.example` to `.env.local` and fill values (see `tech_setup_v2.md` at repo root).
2. Install deps: `npm ci`
3. Apply DB migrations to your Turso database:

```bash
npm run db:migrate
```

(Requires `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the environment, e.g. from `.env.local` — load them in your shell or use a tool like `direnv`.)

4. Dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to sign-in or Today.

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
