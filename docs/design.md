# Time Keeper — design schema (v0.1)

This document is the **contract between design and implementation**. Visual changes start in [Time-keeper/](../Time-keeper/), then tokens and the Next app in [web/](../web/) are updated.

---

## 1. Canonical design source

| Path | Role |
|------|------|
| [Time-keeper/Today v1 (kitchen sink).html](../Time-keeper/Today%20v1%20(kitchen%20sink).html) | **Token reference** (`:root` CSS variables) |
| [Time-keeper/variation-a.jsx](../Time-keeper/variation-a.jsx) | **Production variation** — Workshop Ledger (dense list rhythm, timer card) |
| [Time-keeper/primitives.jsx](../Time-keeper/primitives.jsx) | Icons, phone shell patterns, shared micro-components |
| [Time-keeper/variation-b.jsx](../Time-keeper/variation-b.jsx), [variation-c.jsx](../Time-keeper/variation-c.jsx) | Alternate directions — **not** v0.1 default |
| [Time-keeper/bundle.jsx](../Time-keeper/bundle.jsx), [bundle-v1.jsx](../Time-keeper/bundle-v1.jsx) | Composed references |

### Chosen production variation (v0.1)

**Variation A — Workshop Ledger** (`variation-a.jsx`), with color tokens taken from **Today v1 (kitchen sink).html** so the live app matches the kitchen-sink palette.

If you change the canonical variation, update this section and re-sync [web/src/styles/design-tokens.ts](../web/src/styles/design-tokens.ts) + [web/src/app/globals.css](../web/src/app/globals.css).

---

## 2. Design tokens (machine-readable)

Source of truth in code: [web/src/styles/design-tokens.ts](../web/src/styles/design-tokens.ts) and CSS variables in [web/src/app/globals.css](../web/src/app/globals.css).

### Palette (from kitchen sink `:root`)

| Token | Hex | Usage |
|-------|-----|--------|
| `--tk-bg` | `#0e0c0a` | App background |
| `--tk-bg-deep` | `#0a0908` | Page backdrop |
| `--tk-surface` | `#161310` | Cards |
| `--tk-surface-2` | `#1e1a14` | Elevated panels |
| `--tk-line` | `#2a241c` | Borders |
| `--tk-line-strong` | `#3a3024` | Strong borders, stop button |
| `--tk-ink` | `#f3ead4` | Primary text |
| `--tk-ink-2` | `#c9bf9f` | Secondary text |
| `--tk-ink-3` | `#8a8167` | Muted |
| `--tk-ink-4` | `#5a5340` | Very muted |
| `--tk-honey` | `#f0b429` | Accent, primary actions |
| `--tk-honey-2` | `#d9991f` | Gradient end |
| `--tk-honey-deep` | `#8a5e10` | Deep accent |
| `--tk-amber` | `#c87c2c` | Secondary accent |
| `--tk-cream` | `#efe4c8` | Large numerals (timer) |
| `--tk-green` | `#6fa66a` | Positive delta |
| `--tk-red` | `#c46a52` | Negative / spend / warnings |

### Typography

- **UI:** Inter (or system-ui fallback) — `font-sans`
- **Numeric / timer:** JetBrains Mono — `font-mono`, tabular nums

### Component mapping (shadcn / Tailwind)

| Design primitive | Implementation |
|------------------|----------------|
| Primary CTA | Honey gradient button (`btn-primary` pattern in globals) |
| Stop / secondary | Dark surface + `line-strong` border (`btn-stop`) |
| Ghost | Border only (`btn-ghost`) |
| Card | `surface` + `line` border, radius 16px |
| Timer hero | Dark gradient strip + `hex-bg-warm` pattern |
| Chips | `chip-line`, `chip-honey`, `chip-red` utility classes |

**Rule:** No arbitrary hex in feature components — use `var(--tk-*)` or Tailwind theme colors mapped from these tokens.

---

## 3. Screen → route mapping

| Design artboard / screen | Route | Notes |
|--------------------------|-------|--------|
| Today (Variation A / kitchen sink) | `/today` | Default authenticated home |
| Sign-in / magic link | `/login` | Unauthenticated entry |
| Categories / settings gear destination | `/categories` | v0.1 minimal nav |

Full bottom nav (Today / Tasks / Habits / Stats / More) is **v0.2+** per spec §7. Until then, use a minimal header nav: Today · Categories · Sign out. Do not add dead tabs without a “Coming in v0.2” label.

---

## 4. Change control

1. Edit [Time-keeper/](../Time-keeper/) prototypes.
2. Update token table in this file if palette changes.
3. Update `design-tokens.ts` / `globals.css` / Tailwind theme.
4. Update React pages in `web/`.

---

## 5. External design tools (optional)

If Figma or another tool becomes authoritative, link it here and state **precedence** (e.g. “Figma overrides JSX prototypes for spacing”). Until then, **repo prototypes win**.
