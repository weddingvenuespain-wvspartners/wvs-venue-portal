# FOREVENTOS Full Portal Rebrand — Design Spec
**Date:** 2026-05-18  
**Project:** wvs-venue-portal → FOREVENTOS  
**Scope:** Full visual rebrand of all portal pages, components, and global styles

---

## Context

The portal was previously branded "Wedding Venues Spain" (WVS) with a brown/espresso/gold palette and Manrope typeface. It is now rebranded as **FOREVENTOS** — a professional SaaS platform for venues and caterings (weddings + MICE events). The domain is `app.foreventos.com`.

The login page (`/login`) has already been redesigned with the FOREVENTOS aesthetic. The root `/` now redirects to `/login` (logged-out) or `/dashboard` (logged-in). The marketing landing page has been removed.

---

## Creative Direction Summary

**Tone:** Professional, premium, technological but warm. Not generic SaaS, not "AI slop".

**Palette:**
```css
--fe-deep:      #0A1628   /* near-black navy — hero dark, sidebar */
--fe-dark:      #0D1B2A   /* deep navy — dark alternating sections */
--fe-darker:    #070F1B   /* footer */
--fe-bg-light:  #F4F6F8   /* off-white blue — light sections, main bg */
--fe-primary:   #2E6DB4   /* mid blue — CTAs, links, active states */
--fe-accent:    #5EAEF7   /* sky blue — highlights, icons, focus rings */
--fe-text-light: #E8ECF1
--fe-text-dim:  #8899AA
--fe-text-dark: #1A1A2E
--fe-text-muted: #555
```

**Typography:**
- Headlines: Satoshi Bold 700, `letter-spacing: -1px to -2px`, `line-height: 1.04–1.10`
- Body + UI: Inter Regular 400 / Medium 500, min 14px
- Global: `-webkit-font-smoothing: antialiased; text-wrap: pretty`

**Shadows:** Always blue-tinted. `box-shadow: 0 20px 60px rgba(10,22,40,0.4)`. Never pure grey.

**Borders:**
- On dark: `rgba(255,255,255,0.08–0.12)`
- On light: `rgba(0,0,0,0.06–0.10)`

**Effects:**
- Liquid glass: `backdrop-filter: blur(50px) saturate(160%)`, border 1px, inset depth line
- Radial glows: primary/accent at 8–20% opacity, `filter: blur(40–80px)`
- No linear gradients. Only subtle radials or gradient text (Satoshi, sky→primary)

**Logo assets** (in `public/foreventos-assets/`):
- `LOGOMENUFONDOAZUL.png` — on dark backgrounds (sidebar)
- `LOGOMENUFONDOBLANCO.png` — on light backgrounds
- `FOREVENTOS-FAVICON.png` → `public/favicon.png` + `public/favicon.ico`

---

## Implementation Layers

### Layer 1: `app/globals.css` — Token swap + all component styles

**Font imports** — replace:
```css
/* REMOVE */
@import 'Manrope'
@import 'Cormorant Garamond'

/* ADD */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap');
```

**CSS custom properties** — complete replacement:
```css
:root {
  /* FOREVENTOS palette */
  --fe-deep:       #0A1628;
  --fe-dark:       #0D1B2A;
  --fe-darker:     #070F1B;
  --fe-bg-light:   #F4F6F8;
  --fe-primary:    #2E6DB4;
  --fe-accent:     #5EAEF7;
  --fe-text-light: #E8ECF1;
  --fe-text-dim:   #8899AA;
  --fe-text-dark:  #1A1A2E;
  --fe-text-muted: #555;
  --fe-border-dark: rgba(255,255,255,0.10);
  --fe-border-light: rgba(0,0,0,0.08);
  --fe-shadow:     0 4px 24px rgba(10,22,40,0.12);
  --fe-shadow-lg:  0 20px 60px rgba(10,22,40,0.40);

  /* Tailwind/shadcn overrides (HSL) */
  --background:    210 20% 97%;    /* #F4F6F8 */
  --foreground:    220 40% 10%;    /* #1A1A2E */
  --card:          0 0% 100%;
  --card-foreground: 220 40% 10%;
  --primary:       213 59% 45%;    /* #2E6DB4 */
  --primary-foreground: 0 0% 100%;
  --ring:          210 90% 67%;    /* #5EAEF7 */
  --border:        210 15% 88%;
  --input:         210 15% 88%;
  --muted:         210 15% 94%;
  --muted-foreground: 210 15% 50%;
  --radius:        0.625rem;       /* 10px */

  /* Sidebar */
  --sidebar-w: 240px;

  /* Legacy aliases — keep for inline styles not yet migrated */
  --gold:       #2E6DB4;   /* → primary */
  --gold-light: #5EAEF7;   /* → accent */
  --espresso:   #0A1628;   /* → deep */
  --charcoal:   #1A1A2E;   /* → text-dark */
  --cream:      #F4F6F8;   /* → bg-light */
  --ivory:      rgba(0,0,0,0.08); /* → border-light */
  --stone:      #8899AA;   /* → text-dim */
  --warm-gray:  #555;      /* → text-muted */
}
```

**Body:**
```css
body {
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-wrap: pretty;
}
```

**Sidebar (in globals):**
```css
.sidebar { background: var(--fe-deep); }
.sidebar-logo .brand { color: #fff; font-family: 'Inter', sans-serif; }
.sidebar-logo .venue-name { color: var(--fe-text-dim); }
.nav-section { color: var(--fe-text-dim); }
.nav-item { color: var(--fe-text-dim); font-family: 'Inter', sans-serif; font-weight: 400; }
.nav-item:hover { color: #fff; background: rgba(94,174,247,0.06); }
.nav-item.active { color: var(--fe-accent); background: rgba(46,109,180,0.12); border-left-color: var(--fe-primary); }
.avatar { background: var(--fe-primary); color: #fff; }
```

**Main layout:**
```css
.main-layout { background: var(--fe-bg-light); }
.topbar { background: #fff; border-bottom: 1px solid rgba(0,0,0,0.07); box-shadow: 0 1px 0 rgba(10,22,40,0.05); }
.topbar-title { font-family: 'Satoshi', 'Inter', sans-serif; color: var(--fe-text-dark); font-weight: 700; letter-spacing: -0.5px; }
```

**Cards:**
```css
.card { border-radius: 14px; border-color: rgba(0,0,0,0.07); box-shadow: 0 2px 12px rgba(10,22,40,0.07), inset 0 1px 0 rgba(255,255,255,0.8); }
.card:hover { box-shadow: 0 6px 24px rgba(10,22,40,0.10); }
.card-title { color: var(--fe-text-dark); font-family: 'Inter', sans-serif; }
```

**Buttons:**
```css
.btn { font-family: 'Inter', sans-serif; border-radius: 8px; }
.btn-primary { background: var(--fe-primary); color: #fff; }
.btn-primary:hover { background: #2660a0; }
.btn-ghost { border-color: rgba(0,0,0,0.12); color: var(--fe-text-dark); }
.btn-ghost:hover { background: rgba(46,109,180,0.05); }
```

**Quick actions:**
```css
.qa-primary { background: var(--fe-primary); box-shadow: 0 1px 4px rgba(46,109,180,0.25); }
.qa-primary:hover { background: #2660a0; }
.qa-ghost { background: #fff; border-color: rgba(0,0,0,0.12); color: var(--fe-text-dark); }
.qa-ghost:hover { background: var(--fe-bg-light); border-color: var(--fe-accent); }
```

**Forms:**
```css
.form-input:focus { border-color: var(--fe-primary); box-shadow: 0 0 0 3px rgba(94,174,247,0.20); }
.form-textarea:focus { border-color: var(--fe-primary); box-shadow: 0 0 0 3px rgba(94,174,247,0.20); }
```

**Tabs:**
```css
.tab.active { color: var(--fe-primary); border-bottom-color: var(--fe-primary); }
.ficha-tab:hover, .ficha-tab.active { background: var(--fe-primary); }
```

**Tables:**
```css
table.data-table th { background: var(--fe-bg-light); color: var(--fe-text-muted); }
table.data-table tr:hover td { background: rgba(46,109,180,0.03); }
```

**Scrollbar:**
```css
*::-webkit-scrollbar-thumb { background: rgba(94,174,247,0.35); }
*::-webkit-scrollbar-thumb:hover { background: var(--fe-accent); }
* { scrollbar-color: rgba(94,174,247,0.35) transparent; }
```

**Stat cards:**
```css
.stat-card.accent { border-top-color: var(--fe-primary); }
.stat-value { color: var(--fe-text-dark); }
.stat-sub.warn { color: var(--fe-primary); }
```

**Dark mode (`[data-theme="dark"]`):** Rewrite with navy tokens. Sidebar → `#070F1B`. Cards → `rgba(13,27,42,0.8)`. Inputs bg → `rgba(255,255,255,0.04)`.

---

### Layer 2: `app/layout.tsx` + favicon

- `<title>FOREVENTOS</title>`
- `description`: "Plataforma comercial para venues y caterings — bodas y eventos MICE"
- Add `<link rel="icon" href="/favicon.png" />`
- Add font preconnect for `api.fontshare.com` (Satoshi)
- Copy `FOREVENTOS-FAVICON.png` → `public/favicon.png`
- Copy `LOGOMENUFONDOAZUL.png` + `LOGOMENUFONDOBLANCO.png` → `public/foreventos-assets/`

---

### Layer 3: `components/Sidebar.tsx`

Changes:
1. Logo area: replace `<span className="brand">Wedding Venues Spain</span>` with `<img src="/foreventos-assets/LOGOMENUFONDOAZUL.png" alt="FOREVENTOS" height="28" />`
2. Venue switcher dropdown bg: `#0D1B2A`
3. Active venue avatar: `background: var(--fe-primary)` (was gold)
4. Venue switcher active color: `var(--fe-accent)` (was gold)
5. All inline `var(--gold)` → `var(--fe-primary)` or `var(--fe-accent)` (contextual)
6. All `fontFamily: 'Manrope, sans-serif'` → `'Inter', sans-serif`
7. Role label: "Administrador WVS" → "Administrador FOREVENTOS"
8. User menu dropdown bg: `#0D1B2A`, border `rgba(255,255,255,0.10)`
9. Trial banners: gold color refs → primary/accent blue
10. Plan badge backgrounds: keep semantic colors, update font

---

### Layer 4: Shared components

- `components/Spinner.tsx`: stroke/fill gold → `#2E6DB4`
- `components/protectedroute.tsx`: loader text/colors WVS → FOREVENTOS
- `app/page.tsx`: already updated (dots color → `#5EAEF7`) ✓
- `lib/theme-context.tsx`: if it has hardcoded WVS colors, update to FOREVENTOS

---

### Layer 5: Page-by-page — inline style audit

Each page needs a pass to replace:
- `fontFamily: 'Manrope'` → `'Inter', sans-serif`  
- `fontFamily: 'Cormorant Garamond'` → `'Satoshi', 'Inter', sans-serif`
- `color: 'var(--gold)'` → `var(--fe-primary)` or `var(--fe-accent)`
- `color: '#C4975A'` → `#2E6DB4`
- `color: 'var(--espresso)'` / `#1A1512` → `var(--fe-text-dark)`
- `background: 'var(--espresso)'` → `var(--fe-deep)`
- `color: 'var(--cream)'` → `var(--fe-bg-light)`
- `color: 'var(--stone)'` → `var(--fe-text-dim)`
- `color: 'var(--warm-gray)'` → `var(--fe-text-muted)`
- `border: '1px solid var(--ivory)'` → `1px solid rgba(0,0,0,0.08)`
- Any "Wedding Venues Spain" text → "FOREVENTOS"
- WVS logo `<img>` srcs → `/foreventos-assets/LOGOMENUFONDOBLANCO.png` (on light) or `LOGOMENUFONDOAZUL.png` (on dark)

**Priority order:**
1. `app/dashboard/page.tsx`
2. `app/leads/page.tsx`, `app/crm/page.tsx`, `app/pipeline/page.tsx`
3. `app/proposals/` (all sub-pages), `app/budgets/` (all sub-pages)
4. `app/onboarding/page.tsx`, `app/signup/page.tsx`, `app/pricing/page.tsx`
5. `app/checkout/`, `app/estadisticas/`, `app/facturas/`, `app/calendario/`
6. `app/canales/`, `app/comunicacion/`, `app/venue-settings/`, `app/perfil/`
7. `app/catering/` (all), `app/wp/` (all), `app/admin/` (all)
8. All `components/` files with inline styles

---

### Layer 6: Public-facing pages (signup, pricing, onboarding)

These are the most user-visible non-login pages:
- `app/signup/page.tsx`: full FOREVENTOS dark theme (like login — same aesthetic)
- `app/pricing/page.tsx`: FOREVENTOS branding, navy/blue hero section
- `app/onboarding/page.tsx`: FOREVENTOS branding, progress steps with primary blue

---

## Files NOT changing

- All API routes (`app/api/**`) — no visual content
- All `lib/` logic files (supabase, billing, proposals, etc.) — no visual content
- Database schemas / migrations
- Proposal templates (client-facing — separate brand system)

---

## Assets to copy

```
Downloads/FOREVENTOS-FAVICON.png   → public/favicon.png
Downloads/LOGOMENUFONDOAZUL.png    → public/foreventos-assets/LOGOMENUFONDOAZUL.png
Downloads/LOGOMENUFONDOBLANCO.png  → public/foreventos-assets/LOGOMENUFONDOBLANCO.png
```
(favicon.png already exists from previous step — replace with new one)

---

## Success criteria

- [ ] No "Wedding Venues Spain" text visible in the logged-in portal
- [ ] No brown/gold/espresso colors visible anywhere
- [ ] Sidebar shows FOREVENTOS logo on dark navy background
- [ ] All CTAs and focus rings are blue (primary/accent)
- [ ] Inter used for all body text; Satoshi for page titles/headings
- [ ] Browser favicon shows FOREVENTOS favicon
- [ ] Page title in tab reads "FOREVENTOS"
- [ ] Dark mode uses navy palette (not brown)
- [ ] app.foreventos.com/login → FOREVENTOS login (already done)
- [ ] app.foreventos.com/ → redirects to login (already done)
