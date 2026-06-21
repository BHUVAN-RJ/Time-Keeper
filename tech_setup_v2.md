# Tech Setup v2 — Personal Productivity App

Self-contained deployment walkthrough. Read end-to-end before starting; later steps depend on earlier ones.

---

## 1. Cost summary

**Running this app for you + a few friends: $0/mo.**

| Service | Free tier | When you'd pay |
|---|---|---|
| Turso (DB) | 5GB storage, 500M row reads/mo, no inactivity pause | Never for personal use |
| Vercel (hosting) | 100GB bandwidth/mo, 1M function invocations/mo | Never for personal use. App pauses if bandwidth hit (effectively impossible at your scale) |
| Resend (email) | 3,000 emails/mo, 100/day, 1 verified domain | Never. You'll send <10/month for auth |
| GitHub (code + CI) | Unlimited private repos, 2,000 Actions minutes/mo on free | Never for this scale |
| Domain (optional) | — | $10–15/yr for custom domain |

**Caveats:**
- Vercel Hobby is **non-commercial only**. Personal use + sharing with friends without payment = fine. If anyone ever pays you for access, upgrade to Pro ($20/mo) first.
- Resend's 100/day cap is irrelevant for personal auth.
- Turso has not paused projects on inactivity. Verify at signup.

---

## 2. Accounts to create

Create these before writing code. Each takes ~3 minutes.

### 2.1 GitHub
Make a new private repo: `timesheet-app` or similar.

### 2.2 Turso
```bash
# Install CLI
curl -sSfL https://get.tur.so/install.sh | bash
turso --version
turso auth login

# Create DBs
turso db create timesheet-prod
turso db create timesheet-dev   # optional separate dev DB

# Get connection strings
turso db show timesheet-prod --url       # save this
turso db tokens create timesheet-prod    # save this token
turso db show timesheet-dev --url
turso db tokens create timesheet-dev
```

### 2.3 Vercel
1. https://vercel.com → sign up with GitHub.
2. Authorize Vercel to read your repos.
3. Don't deploy yet.

### 2.4 Resend
1. https://resend.com → sign up.
2. Verify a domain (subdomain of your existing domain is easiest, e.g., `mail.bhuvanrj.me`).
3. Add SPF, DKIM, DMARC DNS records given by Resend. Propagation: 5–60 min.
4. Generate API key. Save it.
5. **Shortcut for v0.1:** use `onboarding@resend.dev` as the sender — no domain verification needed. Set up your own domain before v0.2.

### 2.5 Domain (optional)
Pick a subdomain like `time.bhuvanrj.me`. You'll point it at Vercel after first deploy.

---

## 3. Local development

### 3.1 Prerequisites

```bash
node --version    # need ≥18.17, prefer 20 LTS
npm --version
git --version
```

If Node missing or old:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

### 3.2 Bootstrap

```bash
cd ~/projects
npx create-next-app@latest timesheet-app
# TypeScript: Yes
# ESLint: Yes
# Tailwind: Yes
# src/ directory: Yes
# App Router: Yes
# Turbopack: Yes
# Import alias: default (@/*)

cd timesheet-app
git init && git add . && git commit -m "Initial scaffold"
git remote add origin https://github.com/YOUR_USERNAME/timesheet-app.git
git push -u origin main
```

### 3.3 Dependencies

```bash
# DB
npm install drizzle-orm @libsql/client
npm install -D drizzle-kit

# Auth
npm install next-auth@beta @auth/drizzle-adapter resend

# UI
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog input label select tabs toast

# State & queries
npm install zustand @tanstack/react-query

# Dates
npm install date-fns date-fns-tz

# Charts (v0.2+)
npm install recharts

# Drag-drop (v0.4+)
npm install @dnd-kit/core @dnd-kit/sortable

# PWA
npm install next-pwa
```

### 3.4 Environment variables

Create `.env.local` (already in `.gitignore`):

```env
TURSO_DATABASE_URL=libsql://timesheet-dev-yourname.turso.io
TURSO_AUTH_TOKEN=eyJ...

AUTH_SECRET=run_openssl_below
AUTH_URL=http://localhost:3000

RESEND_API_KEY=re_...
AUTH_RESEND_FROM=onboarding@resend.dev

# v0.2+ Google Calendar (read-only; optional until you connect in Settings)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_TOKEN_ENCRYPTION_KEY=
```

Generate secrets:

```bash
openssl rand -base64 32   # AUTH_SECRET and GOOGLE_TOKEN_ENCRYPTION_KEY (use two runs)
```

**Google Calendar OAuth (v0.2+):** In [Google Cloud Console](https://console.cloud.google.com/) create an OAuth client (Web). Authorized redirect URI must be exactly:

`{AUTH_URL}/api/google-calendar/callback`

(e.g. `http://localhost:3000/api/google-calendar/callback` for local dev). This flow is **separate** from Auth.js magic-link login. See `docs/v0.2-phase.md` §2.

### 3.5 Drizzle schema

Create `src/db/schema.ts`. Translate spec_v4 §5 into Drizzle. Example for `time_blocks`:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const timeBlocks = sqliteTable('time_blocks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  categoryId: text('category_id').notNull().references(() => categories.id),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp' }),
  label: text('label'),
  quality: text('quality', { enum: ['useful', 'meh', 'wasted'] }),
  notes: text('notes'),
  manualEntry: integer('manual_entry', { mode: 'boolean' }).notNull().default(false),
  taskId: text('task_id'),
  habitCompletionId: text('habit_completion_id'),
  projectId: text('project_id'),
  randomBonusApplied: integer('random_bonus_applied', { mode: 'boolean' }).notNull().default(false),
  statedIntent: text('stated_intent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});
```

Create `drizzle.config.ts`:
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
} satisfies Config;
```

Create `src/db/index.ts`:
```typescript
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const db = drizzle(client, { schema });
```

Generate and run first migration:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 3.6 Auth

Create `src/auth.ts`:
```typescript
import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_RESEND_FROM!,
    }),
  ],
  session: { strategy: 'database' },
});
```

Create `src/app/api/auth/[...nextauth]/route.ts`:
```typescript
export { GET, POST } from '@/auth';
```

Add the Auth.js Drizzle adapter tables (sessions, accounts, verification tokens) to your schema. Reference: https://authjs.dev/getting-started/adapters/drizzle

### 3.7 Run locally

```bash
npm run dev
# → localhost:3000
```

---

## 4. CI/CD with GitHub Actions

You said you want to build this yourself for learning. Good call — useful workflow knowledge. But **scope tightly**: use Actions for *checks*, let Vercel handle deploys. Don't reinvent Vercel's deploy.

### 4.1 What this pipeline does

| Trigger | Job | Purpose |
|---|---|---|
| PR opened/updated | typecheck + lint + build | Catch errors before merge |
| Push to `main` | same + run migrations (manual approval) | Pre-deploy safety check |
| Weekly schedule | DB backup | Off-site copy |
| Manual dispatch | Same as weekly | On-demand backup |

Vercel's GitHub integration handles the actual deploy on push to `main` automatically — no Action needed for that part.

### 4.2 Repo secrets

Settings → Secrets and variables → Actions → New repository secret:

- `TURSO_PROD_URL`
- `TURSO_PROD_TOKEN`
- `TURSO_DEV_URL` (optional, for testing migrations in CI)
- `TURSO_DEV_TOKEN`

### 4.3 Workflow 1: PR checks

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    name: Typecheck, lint, build
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build
        env:
          # Provide dummy values so build doesn't fail on missing env
          TURSO_DATABASE_URL: libsql://placeholder.turso.io
          TURSO_AUTH_TOKEN: placeholder
          AUTH_SECRET: placeholder-secret-for-build-only-32chars
          AUTH_URL: http://localhost:3000
          RESEND_API_KEY: re_placeholder
          AUTH_RESEND_FROM: onboarding@resend.dev
```

**Why dummy env vars for build:** Next.js build step doesn't actually connect to your DB, but it needs the vars to exist or it errors out. Real values only matter at runtime on Vercel.

### 4.4 Workflow 2: Migration check on PR

When you change the schema, you want CI to verify the migration is valid (parses, generates clean SQL) before merge — not the day of a broken deploy.

`.github/workflows/migration-check.yml`:

```yaml
name: Migration check

on:
  pull_request:
    paths:
      - 'src/db/schema.ts'
      - 'drizzle/migrations/**'
      - 'drizzle.config.ts'

jobs:
  check:
    name: Validate migrations
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Check migrations are up to date
        run: |
          # Generate migrations; if anything new is produced, schema and migrations are out of sync
          npx drizzle-kit generate
          if [[ -n $(git status --porcelain drizzle/migrations) ]]; then
            echo "::error::Schema changed but migrations weren't regenerated. Run 'npx drizzle-kit generate' locally and commit."
            git status
            exit 1
          fi
```

### 4.5 Workflow 3: Production migration (manual approval)

`.github/workflows/migrate-prod.yml`:

```yaml
name: Migrate production DB

on:
  workflow_dispatch:   # Manual trigger only — no automatic prod migrations

jobs:
  migrate:
    name: Apply migrations to prod
    runs-on: ubuntu-latest
    environment: production   # Add a "production" environment in repo settings for approval gating
    timeout-minutes: 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Run migrations
        env:
          TURSO_DATABASE_URL: ${{ secrets.TURSO_PROD_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_PROD_TOKEN }}
        run: npx drizzle-kit migrate
```

**Manual-only intentionally.** Auto-migrating prod on push is a footgun. You want to: (a) merge the PR, (b) let Vercel deploy the new code, (c) verify deploy looks healthy, (d) trigger this workflow, (e) confirm app works with new schema. Five steps but each takes seconds and you control the timing.

To add the "production" environment approval: repo Settings → Environments → New environment → "production" → Required reviewers → yourself. Now this workflow waits for your click before running.

### 4.6 Workflow 4: Weekly DB backup

`.github/workflows/backup.yml`:

```yaml
name: Weekly DB backup

on:
  schedule:
    - cron: '0 14 * * 0'    # Sundays 2pm UTC (7am PT)
  workflow_dispatch:

jobs:
  backup:
    name: Dump prod DB and commit
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4
        with:
          ref: backups   # checkout a separate branch named 'backups'

      - name: Install Turso CLI
        run: |
          curl -sSfL https://get.tur.so/install.sh | bash
          echo "$HOME/.turso" >> $GITHUB_PATH

      - name: Authenticate Turso
        env:
          TURSO_API_TOKEN: ${{ secrets.TURSO_PROD_TOKEN }}
        run: turso auth login --headless

      - name: Dump database
        run: |
          DATE=$(date +%Y%m%d)
          mkdir -p backups
          turso db shell timesheet-prod ".dump" > "backups/backup-$DATE.sql"

      - name: Commit backup
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add backups/
          git commit -m "Backup $(date +%Y-%m-%d)" || echo "No changes"
          git push origin backups
```

**Notes:**
- Create a `backups` branch first: `git checkout --orphan backups && git rm -rf . && git commit --allow-empty -m "init" && git push origin backups`.
- Backups live in your private repo, free forever, easy to restore.
- For larger DBs later, switch to S3/R2 storage. For your scale, repo is fine.

### 4.7 Vercel integration (no Action needed)

Vercel's GitHub app handles deploys automatically:
- Push to `main` → production deploy.
- Push to any branch → preview deploy with a unique URL.
- PR opens → preview URL posted as comment on the PR.

You don't need a GitHub Action for any of this. It just works once you import the repo into Vercel.

### 4.8 Local CI mirror (run before pushing)

Save yourself a CI roundtrip by running the same checks locally:

```bash
# package.json scripts
"scripts": {
  "check": "tsc --noEmit && npm run lint && npm run build",
  "check:migrations": "npx drizzle-kit generate && git diff --exit-code drizzle/migrations"
}
```

Then before any push:
```bash
npm run check
```

If green locally, green in CI 95% of the time.

### 4.9 What you'll learn from this pipeline

- Workflow triggers (`pull_request`, `push`, `schedule`, `workflow_dispatch`)
- Secrets and environment scoping
- Approval gates via environments
- Caching dependencies (`cache: 'npm'`)
- Conditional steps with shell logic
- Working with non-default branches (the backup branch)

If you want more, look at: matrix builds (Node version compatibility), composite actions, reusable workflows. Skip artifacts and Docker for this project; not needed.

---

## 5. Deployment to Vercel

### 5.1 First deploy

1. vercel.com → New Project → Import GitHub → select repo.
2. Vercel auto-detects Next.js. Don't change build settings.
3. **Environment Variables** (under project settings):
   - `TURSO_DATABASE_URL` → prod URL
   - `TURSO_AUTH_TOKEN` → prod token
   - `AUTH_SECRET` → from `openssl rand -base64 32`
   - `AUTH_URL` → `https://your-app.vercel.app` initially, change to custom domain later
   - `RESEND_API_KEY`
   - `AUTH_RESEND_FROM`
4. Deploy. First build: 2–4 min.

### 5.2 Custom domain

1. Vercel project → Settings → Domains → Add `time.bhuvanrj.me`.
2. Vercel shows a CNAME record. Add it in your DNS provider.
3. DNS propagation: 5–60 min.
4. Update `AUTH_URL` env var → redeploy.

### 5.3 Migration workflow on deploy

**Don't** put `drizzle-kit migrate` in your Vercel build script. A bad migration breaks all future deploys.

**Do** use the manual GitHub Action from §4.5 — migrate prod explicitly after each schema change.

**Current migration head (Time Keeper repo, June 2026):** `web/drizzle/0016_early_grim_reaper.sql`

```bash
cd web
source .env.local
npm run db:migrate
```

Adds `time_blocks.habit_id`, `time_blocks.focus_target_minutes`, and `shop_items` / `shop_redemptions`. Feature details: [`specs/003-rewards-sync-shop/implementation-record.md`](../specs/003-rewards-sync-shop/implementation-record.md).

If `git push` fails with a 403 (wrong GitHub account on HTTPS), run `gh auth setup-git` so git uses your active `gh` credentials.

---

## 6. PWA configuration

### 6.1 Manifest

`public/manifest.json`:
```json
{
  "name": "Timesheet",
  "short_name": "Timesheet",
  "description": "Personal productivity tracker",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Generate icons from a 1024x1024 source with `npx pwa-asset-generator` or https://www.pwabuilder.com/imageGenerator.

### 6.2 Service worker

`public/sw.js`:
```javascript
const CACHE = 'timesheet-v1';
const ASSETS = ['/', '/manifest.json', '/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
```

Register in `src/app/layout.tsx`:
```typescript
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

Bump `CACHE` version on every deploy with breaking changes.

### 6.3 Install prompt

In `<head>`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0a0a0a" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

On iOS: install via Safari Share → Add to Home Screen (no programmatic prompt). On Android Chrome: browser auto-prompts.

---

## 7. Pre-launch checklist

Before deploying v0.1:

- [ ] Turso prod DB created, schema migrated
- [ ] Resend domain verified OR using `onboarding@resend.dev`
- [ ] All env vars in Vercel
- [ ] `AUTH_URL` matches deploy URL exactly
- [ ] Magic link tested end-to-end on deployed URL
- [ ] PWA manifest + service worker registered
- [ ] Custom domain CNAME verified (if using)
- [ ] First test signup works
- [ ] Categories seeded for new user
- [ ] First time_block can be created and stopped
- [ ] GitHub Actions CI passing on main

---

## 8. Common pitfalls

| Pitfall | Fix |
|---|---|
| Magic link goes to spam | Set SPF, DKIM, DMARC. Use real domain (not resend.dev) for production. |
| `AUTH_URL` mismatch | Redirects fail silently. Set per environment. |
| Migration runs against wrong DB | Always check `TURSO_DATABASE_URL` env. Separate dev/prod tokens. |
| Service worker caches stale code | Bump `CACHE` version on each deploy. |
| iOS PWA loses state | iOS aggressively reclaims memory. Persist client state to server or localStorage. |
| Turso connection limits | Use the HTTP libsql client (default). Avoid persistent connections in serverless. |
| Vercel build fails, works locally | Missing env var in Vercel. Check Project → Settings → Environment Variables. |
| Drizzle types out of sync | Re-run `npx drizzle-kit generate` after schema changes. |

---

## 9. Day-to-day workflow

```bash
# Start of day
git pull
npm run dev   # localhost:3000

# Schema changes
# 1. Edit src/db/schema.ts
npx drizzle-kit generate
npx drizzle-kit migrate   # applies to dev DB
# Test locally
npm run check             # typecheck + lint + build

# Commit
git add . && git commit -m "..."
git push                  # Vercel deploys preview automatically

# Merge PR to main → production preview deploys
# Once code is in prod, trigger migrate-prod GitHub Action manually
# Verify app works → done
```

Use Vercel preview deployments aggressively. Every branch gets its own URL. Test before merging.

---

## 10. When things break

| Symptom | Likely cause | Fix |
|---|---|---|
| Login fails silently | Wrong AUTH_URL or unverified Resend domain | Check Vercel env vars and Resend domain status |
| DB query returns empty | Wrong DB pointed (dev vs prod) | Check current `TURSO_DATABASE_URL` |
| Build fails on Vercel only | Missing env var | Vercel → Settings → Environment Variables |
| PWA install button missing | Manifest or HTTPS issue | Chrome DevTools → Application → Manifest |
| Service worker won't update | Browser caching | Unregister in DevTools, hard reload |
| Drizzle types out of sync | Schema changed without regen | `npx drizzle-kit generate` |

---

## 11. Cost monitoring

Set up alerts now:

- **Vercel**: Settings → Usage → enable spend alerts at $1 threshold.
- **Turso**: dashboard shows usage; no surprise charges possible on free.
- **Resend**: dashboard shows monthly count.

You will not approach any limit at personal scale. Alerts exist because accidentally clicking "upgrade" can cost money.

---

## 12. Portability

Free tiers shift over time. This stack is designed for portability:

| Service | Alternative |
|---|---|
| Turso → Postgres | `turso db shell ".dump"` → import via psql. Drizzle abstracts most differences. |
| Vercel → Cloudflare Pages / Railway / Fly.io | Next.js deploys everywhere. ISR and Edge Middleware may need tweaks; you're not using either. |
| Resend → SES / Postmark / SendGrid | Swap one API call. |

**Things to avoid for portability:** Vercel KV, Vercel Blob, Vercel Postgres, Edge Config. Stick to portable infra. This setup already follows that rule.

---

## 13. Pre-coding checklist

Before `npx create-next-app`:

- [ ] All accounts created (Turso, Vercel, Resend, GitHub)
- [ ] Resend domain verified OR decided to use dev sender for v0.1
- [ ] Custom domain decided OR will use Vercel default URL
- [ ] `AUTH_SECRET` generated
- [ ] `.env.local` values ready
- [ ] GitHub Actions secrets added (`TURSO_PROD_URL`, `TURSO_PROD_TOKEN`)
- [ ] Production environment in GitHub for manual approval

Estimated setup time: 1–2 hours before first line of code. Don't skip; context-switching mid-build is more expensive.

Then: ship v0.1 from `spec_v4.md`. Start using it. Then come back for v0.2.
