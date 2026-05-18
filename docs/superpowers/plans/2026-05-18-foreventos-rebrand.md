# FOREVENTOS Full Portal Rebrand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the entire wvs-venue-portal from "Wedding Venues Spain" (brown/gold/espresso palette, Manrope font) to "FOREVENTOS" (navy blue palette, Inter/Satoshi fonts), replacing all colours, typography, logos, and brand text across every page and component.

**Architecture:** Three-wave approach. Wave 1 = token swap in `globals.css` + `layout.tsx` (cascades automatically to ~80% of UI via CSS variables). Wave 2 = targeted component changes (Sidebar, Spinner, protectedroute). Wave 3 = global automated find-replace pass across all `.tsx` files to catch hardcoded hex values and font family strings that bypass CSS variables.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, shadcn/ui, inline React styles, custom CSS classes in `globals.css`, PowerShell for batch text replacement.

**Working directory for all commands:** `C:\Users\Guillermo\OneDrive\Escritorio\wvs-venue-portal\.claude\worktrees\focused-shtern-2174c1`

---

## File Map

| File | Change type |
|------|-------------|
| `app/globals.css` | Complete rewrite — new FOREVENTOS tokens + all component styles |
| `app/layout.tsx` | Title, description, favicon link, Fontshare preconnect |
| `public/favicon.png` | Replace with FOREVENTOS favicon |
| `public/foreventos-assets/LOGOMENUFONDOAZUL.png` | Copy from Downloads (sidebar logo) |
| `public/foreventos-assets/LOGOMENUFONDOBLANCO.png` | Copy from Downloads (light-bg logo) |
| `components/Sidebar.tsx` | Logo image, gold→primary colour refs, Manrope→Inter, role label |
| `components/Spinner.tsx` | Default colour `var(--gold)` → `var(--fe-primary)` |
| `components/protectedroute.tsx` | Background + spinner colour |
| All `app/**/*.tsx` + `components/**/*.tsx` | Automated replace: hardcoded hex colours + font family strings |

---

## Task 1: Copy brand assets to public folder

**Files:**
- Create/Replace: `public/favicon.png`
- Create: `public/foreventos-assets/LOGOMENUFONDOAZUL.png`
- Create: `public/foreventos-assets/LOGOMENUFONDOBLANCO.png`

- [ ] **Step 1: Copy the three assets**

```powershell
$base = "C:\Users\Guillermo\OneDrive\Escritorio\wvs-venue-portal\.claude\worktrees\focused-shtern-2174c1"
$dl   = "C:\Users\Guillermo\Downloads"

Copy-Item "$dl\FOREVENTOS-FAVICON.png"   "$base\public\favicon.png" -Force
Copy-Item "$dl\LOGOMENUFONDOAZUL.png"   "$base\public\foreventos-assets\LOGOMENUFONDOAZUL.png" -Force
Copy-Item "$dl\LOGOMENUFONDOBLANCO.png" "$base\public\foreventos-assets\LOGOMENUFONDOBLANCO.png" -Force

Write-Output "Assets copied:"
Get-ChildItem "$base\public\foreventos-assets" | Select-Object Name, Length
```

Expected output: lists `favicon.png` in public, `LOGOMENUFONDOAZUL.png`, `LOGOMENUFONDOBLANCO.png`, `favicon.png` in foreventos-assets.

- [ ] **Step 2: Commit**

```bash
git add public/favicon.png public/foreventos-assets/
git commit -m "chore: add FOREVENTOS brand assets (favicon, logos)"
```

---

## Task 2: Update `app/layout.tsx`

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ThemeProvider } from '@/lib/theme-context'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'FOREVENTOS',
  description: 'Plataforma comercial para venues y caterings — bodas y eventos MICE',
  icons: { icon: '/favicon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.fontshare.com" />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors relating to `layout.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: update layout — FOREVENTOS title, favicon, Fontshare preconnect"
```

---

## Task 3: Rewrite `app/globals.css`

**Files:**
- Modify: `app/globals.css` (complete replacement)

- [ ] **Step 1: Replace the entire file with the FOREVENTOS token system**

Write the following content to `app/globals.css`:

```css
/* ── Fonts ──────────────────────────────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ── FOREVENTOS Design Tokens ── */
    --fe-deep:        #0A1628;
    --fe-dark:        #0D1B2A;
    --fe-darker:      #070F1B;
    --fe-bg-light:    #F4F6F8;
    --fe-primary:     #2E6DB4;
    --fe-accent:      #5EAEF7;
    --fe-text-light:  #E8ECF1;
    --fe-text-dim:    #8899AA;
    --fe-text-dark:   #1A1A2E;
    --fe-text-muted:  #555;
    --fe-border-dark: rgba(255,255,255,0.10);
    --fe-border-light:rgba(0,0,0,0.08);
    --fe-shadow:      0 4px 24px rgba(10,22,40,0.10);
    --fe-shadow-lg:   0 20px 60px rgba(10,22,40,0.40);

    /* ── Tailwind / shadcn (HSL) ── */
    --background:          210 20% 97%;
    --foreground:          220 40% 10%;
    --card:                0 0% 100%;
    --card-foreground:     220 40% 10%;
    --popover:             0 0% 100%;
    --popover-foreground:  220 40% 10%;
    --primary:             213 59% 45%;
    --primary-foreground:  0 0% 100%;
    --secondary:           210 15% 94%;
    --secondary-foreground:220 40% 10%;
    --muted:               210 15% 94%;
    --muted-foreground:    210 15% 45%;
    --accent:              210 15% 94%;
    --accent-foreground:   220 40% 10%;
    --destructive:         0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border:              210 15% 88%;
    --input:               210 15% 88%;
    --ring:                210 90% 67%;
    --radius:              0.625rem;

    /* ── Legacy aliases — keep until all inline styles migrated ── */
    --gold:       #2E6DB4;
    --gold-light: #5EAEF7;
    --espresso:   #0A1628;
    --charcoal:   #1A1A2E;
    --cream:      #F4F6F8;
    --ivory:      rgba(0,0,0,0.08);
    --stone:      #8899AA;
    --warm-gray:  #555;

    --sidebar-w: 240px;
  }
}

@layer base {
  * { @apply border-border; box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    text-wrap: pretty;
  }
  a { text-decoration: none; color: inherit; }
}

/* ── Sidebar ─────────────────────────────────────────────────────────────────── */
.sidebar { position: fixed; top: 0; left: 0; width: var(--sidebar-w); height: 100vh; background: var(--fe-deep); display: flex; flex-direction: column; z-index: 100; overflow: hidden; }
.sidebar-logo { padding: 24px 20px 18px; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
.sidebar-logo .brand { font-family: 'Inter', sans-serif; font-size: 15px; color: var(--fe-accent); letter-spacing: 0.04em; font-weight: 600; display: block; }
.sidebar-logo .venue-name { font-size: 10px; color: var(--fe-text-dim); margin-top: 3px; letter-spacing: 0.04em; display: block; }
.sidebar-nav { padding: 12px 0; flex: 1; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; }
.sidebar-nav::-webkit-scrollbar { display: none; }
.nav-section { font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--fe-text-dim); padding: 12px 20px 4px; }
.nav-item { display: flex; align-items: center; gap: 9px; padding: 9px 20px; color: var(--fe-text-dim); cursor: pointer; font-size: 12.5px; font-weight: 400; border-left: 2px solid transparent; transition: all 0.15s; text-decoration: none; font-family: 'Inter', sans-serif; }
.nav-item:hover { color: var(--fe-text-light); background: rgba(94,174,247,0.06); }
.nav-item.active { color: var(--fe-accent); background: rgba(46,109,180,0.12); border-left-color: var(--fe-primary); }
.sidebar-footer { padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.07); }
.avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--fe-primary); display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #fff; flex-shrink: 0; }

/* ── Layout ──────────────────────────────────────────────────────────────────── */
.app-shell { display: flex; min-height: 100vh; }
.main-layout { margin-left: var(--sidebar-w); flex: 1; min-height: 100vh; display: flex; flex-direction: column; background: var(--fe-bg-light); width: calc(100% - var(--sidebar-w)); }
.topbar { background: #fff; border-bottom: 1px solid rgba(0,0,0,0.07); padding: 14px 28px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; box-shadow: 0 1px 0 rgba(10,22,40,0.04); }
.topbar-title { font-family: 'Satoshi', 'Inter', sans-serif; font-size: 22px; font-weight: 700; color: var(--fe-text-dark); letter-spacing: -0.5px; }
.page-content { padding: 24px 28px; flex: 1; max-width: 100%; }

/* ── Cards ───────────────────────────────────────────────────────────────────── */
.card { background: #fff; border: 1px solid rgba(0,0,0,0.07); border-radius: 14px; overflow: hidden; transition: box-shadow 0.2s; box-shadow: 0 2px 8px rgba(10,22,40,0.06), inset 0 1px 0 rgba(255,255,255,0.8); }
.card:hover { box-shadow: 0 6px 24px rgba(10,22,40,0.10); }
.card-header { padding: 14px 20px 12px; border-bottom: 1px solid rgba(0,0,0,0.07); display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 13px; font-weight: 600; color: var(--fe-text-dark); font-family: 'Inter', sans-serif; }
.card-body { padding: 18px 20px; }

/* ── Rich Text Editor ────────────────────────────────────────────────────────── */
[data-rich-editor] h3 { font-size: 15px; font-weight: 600; color: var(--fe-text-dark); margin-top: 14px; margin-bottom: 4px; line-height: 1.4; }
[data-rich-editor] p { margin-bottom: 6px; }
[data-rich-editor] ul, [data-rich-editor] ol { padding-left: 20px; margin-bottom: 6px; }
[data-rich-editor] li { margin-bottom: 2px; }
[data-rich-editor] strong, [data-rich-editor] b { font-weight: 700; }
[data-rich-editor] em, [data-rich-editor] i { font-style: italic; }
[data-rich-editor] u { text-decoration: underline; }

/* ── Stats ───────────────────────────────────────────────────────────────────── */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.stat-card { background: #fff; border: 1px solid rgba(0,0,0,0.07); border-radius: 12px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(10,22,40,0.05); }
.stat-card.accent { border-top: 2px solid var(--fe-primary); }
.stat-label { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fe-text-muted); margin-bottom: 8px; font-family: 'Inter', sans-serif; }
.stat-value { font-family: 'Satoshi', 'Inter', sans-serif; font-size: 28px; font-weight: 700; color: var(--fe-text-dark); line-height: 1; letter-spacing: -0.5px; }
.stat-sub { font-size: 11px; color: var(--fe-text-muted); margin-top: 5px; }
.stat-sub.warn { color: var(--fe-primary); }

/* ── Buttons ─────────────────────────────────────────────────────────────────── */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 16px; min-height: 40px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: none; text-decoration: none; font-family: 'Inter', sans-serif; white-space: nowrap; }
.btn-primary { background: var(--fe-primary); color: #fff; box-shadow: 0 2px 8px rgba(46,109,180,0.25); }
.btn-primary:hover { background: #2660a0; box-shadow: 0 4px 12px rgba(46,109,180,0.35); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { background: transparent; border: 1px solid rgba(0,0,0,0.12); color: var(--fe-text-dark); }
.btn-ghost:hover { background: rgba(46,109,180,0.05); border-color: rgba(46,109,180,0.25); }
.btn-danger { background: transparent; border: 1px solid #fca5a5; color: #dc2626; }
.btn-danger:hover { background: #fef2f2; }
.btn-sm { padding: 0 12px; min-height: 34px; font-size: 12.5px; }

/* ── Quick actions ───────────────────────────────────────────────────────────── */
.qa { display: inline-flex; align-items: center; gap: 5px; padding: 5px 13px; border-radius: 20px; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap; transition: all 0.15s; text-decoration: none; font-family: 'Inter', sans-serif; line-height: 1.4; min-height: 28px; box-sizing: border-box; }
.qa-primary { background: var(--fe-primary); color: #fff; border: none; box-shadow: 0 1px 4px rgba(46,109,180,0.25); }
.qa-primary:hover { background: #2660a0; box-shadow: 0 2px 8px rgba(46,109,180,0.35); transform: translateY(-1px); }
.qa-ghost { background: #fff; color: var(--fe-text-dark); border: 1px solid rgba(0,0,0,0.12); }
.qa-ghost:hover { background: var(--fe-bg-light); border-color: rgba(46,109,180,0.30); color: var(--fe-primary); transform: translateY(-1px); }
.qa-danger { background: #fff5f5; color: #dc2626; border: 1px solid #fca5a5; }
.qa-danger:hover { background: #fee2e2; border-color: #f87171; transform: translateY(-1px); }
.qa-success { background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; }
.qa-success:hover { background: #dcfce7; border-color: #4ade80; color: #15803d; transform: translateY(-1px); }
.qa-locked { cursor: not-allowed; opacity: 0.4; user-select: none; }
.qa-locked:hover { background: #fff; color: var(--fe-text-muted); transform: none; }

/* ── Forms ───────────────────────────────────────────────────────────────────── */
.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fe-text-muted); margin-bottom: 6px; font-family: 'Inter', sans-serif; }
.form-input { width: 100%; min-height: 40px; padding: 8px 12px; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; font-size: 13px; font-family: 'Inter', sans-serif; background: #fff; color: var(--fe-text-dark); transition: all 0.15s; outline: none; }
.form-input:focus { border-color: var(--fe-primary); box-shadow: 0 0 0 3px rgba(94,174,247,0.20); }
.form-textarea { width: 100%; min-height: 80px; padding: 10px 12px; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; font-size: 13px; font-family: 'Inter', sans-serif; background: #fff; color: var(--fe-text-dark); resize: vertical; outline: none; transition: all 0.15s; }
.form-textarea:focus { border-color: var(--fe-primary); box-shadow: 0 0 0 3px rgba(94,174,247,0.20); }
select.form-input { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238899AA' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 34px; cursor: pointer; }
select.form-input option { font-family: 'Inter', sans-serif; font-size: 12.5px; padding: 8px 12px; background: #fff; color: var(--fe-text-dark); }

/* ── Tabs ─────────────────────────────────────────────────────────────────────── */
.tabs { display: flex; border-bottom: 1px solid rgba(0,0,0,0.07); margin-bottom: 20px; }
.tab { padding: 10px 18px; font-size: 12.5px; color: var(--fe-text-muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s; font-family: 'Inter', sans-serif; }
.tab:hover { color: var(--fe-text-dark); }
.tab.active { color: var(--fe-primary); border-bottom-color: var(--fe-primary); font-weight: 500; }

/* ── Badges ──────────────────────────────────────────────────────────────────── */
.badge { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 500; white-space: nowrap; font-family: 'Inter', sans-serif; }
.badge-active, .badge-booked { background: #d1fae5; color: #065f46; }
.badge-pending, .badge-new { background: #fef3c7; color: #92400e; }
.badge-inactive, .badge-lost, .badge-done { background: #f3f4f6; color: #374151; }
.badge-contacted { background: #dbeafe; color: #1e40af; }
.badge-visit { background: #ede9fe; color: #5b21b6; }
.badge-quote { background: #fce7f3; color: #9d174d; }

/* ── Alerts ──────────────────────────────────────────────────────────────────── */
.alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
.alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }
.alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
.alert-warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
.alert-info { background: #eff6ff; border: 1px solid rgba(46,109,180,0.25); color: var(--fe-primary); }

/* ── Grid helpers ────────────────────────────────────────────────────────────── */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .two-col, .three-col, .stats-grid { grid-template-columns: 1fr; } }

/* ── Tables ──────────────────────────────────────────────────────────────────── */
.table-wrapper { overflow-x: auto; width: 100%; }
table.data-table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: 'Inter', sans-serif; }
table.data-table th { text-align: left; padding: 10px 16px; font-size: 10px; font-weight: 600; color: var(--fe-text-muted); letter-spacing: 0.08em; text-transform: uppercase; background: var(--fe-bg-light); border-bottom: 1px solid rgba(0,0,0,0.07); white-space: nowrap; }
table.data-table td { padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,0.06); vertical-align: middle; color: var(--fe-text-dark); }
table.data-table tr:last-child td { border-bottom: none; }
table.data-table tr:hover td { background: rgba(46,109,180,0.03); }

/* ── Photo grid ──────────────────────────────────────────────────────────────── */
.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.photo-thumb { aspect-ratio: 4/3; border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,0,0,0.07); }
.photo-thumb img { width: 100%; height: 100%; object-fit: cover; }

/* ── Login (legacy fallback — login page uses inline styles) ─────────────────── */
.login-page { min-height: 100vh; background: var(--fe-deep); display: flex; align-items: center; justify-content: center; padding: 20px; }
.login-error { background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.3); color: #fca5a5; border-radius: 10px; padding: 10px 14px; font-size: 12px; margin-bottom: 14px; }

/* ── Modal ───────────────────────────────────────────────────────────────────── */
.modal-overlay { position: fixed; inset: 0; background: rgba(10,22,40,0.5); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
.modal { background: #fff; border-radius: 16px; width: 100%; max-width: 440px; max-height: calc(100vh - 48px); display: flex; flex-direction: column; box-shadow: 0 24px 80px rgba(10,22,40,0.25); overflow: hidden; }
.modal-header { flex-shrink: 0; padding: 24px 28px 16px; border-bottom: 1px solid rgba(0,0,0,0.07); }
.modal-body { flex: 1; overflow-y: auto; padding: 20px 28px; scrollbar-width: thin; scrollbar-color: rgba(94,174,247,0.35) transparent; }
.modal-footer { flex-shrink: 0; padding: 16px 28px; border-top: 1px solid rgba(0,0,0,0.07); display: flex; gap: 10px; justify-content: flex-end; }
.modal-title { font-family: 'Satoshi', 'Inter', sans-serif; font-size: 20px; font-weight: 700; color: var(--fe-text-dark); margin-bottom: 4px; letter-spacing: -0.3px; }
.modal-sub { font-size: 12px; color: var(--fe-text-muted); margin-bottom: 0; }
.lead-modal-sublabel { font-size: 11px; font-weight: 700; color: var(--fe-primary); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px; }
.lead-modal-name-badges-row { display: flex; flex-direction: column; gap: 6px; }
.lead-modal-badges { display: flex; flex-direction: row; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
@media (min-width: 900px) {
  .lead-modal-name-badges-row { flex-direction: row; align-items: center; gap: 8px; flex-wrap: wrap; }
  .lead-modal-badges { margin-top: 0; }
}

/* ── Scrollbar ───────────────────────────────────────────────────────────────── */
*::-webkit-scrollbar               { width: 5px; height: 5px; }
*::-webkit-scrollbar-track         { background: transparent; }
*::-webkit-scrollbar-thumb         { background: rgba(94,174,247,0.35); border-radius: 99px; }
*::-webkit-scrollbar-thumb:hover   { background: var(--fe-accent); }
*::-webkit-scrollbar-corner        { background: transparent; }
*                                  { scrollbar-width: thin; scrollbar-color: rgba(94,174,247,0.35) transparent; }

/* ── Content editable ────────────────────────────────────────────────────────── */
[contenteditable] p  { margin: 0 0 4px 0; }
[contenteditable] ul { margin: 4px 0; padding-left: 20px; list-style-type: disc; }
[contenteditable] ol { margin: 4px 0; padding-left: 20px; list-style-type: decimal; }
[contenteditable] li { margin: 2px 0; display: list-item; }
[contenteditable] br { display: block; content: ''; margin: 0; }

/* ── Animations ──────────────────────────────────────────────────────────────── */
@keyframes shimmer     { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes spin        { to { transform: rotate(360deg); } }
@keyframes pulse-dot   { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.7); } }
@keyframes toast-in    { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes secOpen     { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }

/* ── Ficha tabs ──────────────────────────────────────────────────────────────── */
.ficha-tab { position: relative; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; border: none; transition: background 0.15s, color 0.15s; font-family: 'Inter', sans-serif; display: inline-flex; align-items: center; gap: 5px; background: transparent; color: var(--fe-text-muted); font-weight: 500; }
.ficha-tab:hover { background: var(--fe-primary); color: #fff; }
.ficha-tab.active { background: var(--fe-primary); color: #fff; }

/* ── Dirty tab tooltip ───────────────────────────────────────────────────────── */
.dirty-tooltip { display: none; position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 11px; font-weight: 500; color: #fff; background: var(--fe-deep); border-radius: 6px; padding: 5px 10px; z-index: 100; pointer-events: none; box-shadow: var(--fe-shadow); }
.dirty-tooltip::before { content: ''; position: absolute; top: -4px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; background: var(--fe-deep); rotate: 45deg; }
.dirty-tooltip-wrap:hover .dirty-tooltip { display: block; }

/* ── Section dropdowns ───────────────────────────────────────────────────────── */
.sec-row { border: 1px solid rgba(0,0,0,0.07); border-radius: 10px; margin-bottom: 8px; overflow: hidden; transition: border-color .15s; }
.sec-row:hover { border-color: rgba(46,109,180,0.30); }
.sec-header { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 11px 14px; transition: background .15s; user-select: none; }
.sec-header:hover { background: rgba(46,109,180,0.04); }
.sec-open-content { animation: secOpen .28s ease; border-top: 1px solid rgba(0,0,0,0.07); }

/* ── Starter template cards ──────────────────────────────────────────────────── */
.starter-card { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border: 1.5px solid rgba(0,0,0,0.10); border-radius: 12px; background: #fff; cursor: pointer; text-align: left; width: 100%; font-family: 'Inter', sans-serif; transition: border-color .2s, background .2s, transform .2s, box-shadow .2s; }
.starter-card:hover { border-color: var(--fe-primary); background: rgba(46,109,180,0.03); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(46,109,180,0.12); }
.starter-card:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(46,109,180,0.10); }
.starter-card-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--fe-bg-light); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--fe-primary); transition: background .2s, color .2s; }
.starter-card:hover .starter-card-icon { background: var(--fe-primary); color: #fff; }
.starter-card-arrow { flex-shrink: 0; font-size: 18px; color: var(--fe-text-muted); opacity: 0; transform: translateX(-6px); transition: opacity .2s, transform .2s, color .2s; padding-left: 8px; }
.starter-card:hover .starter-card-arrow { opacity: 1; transform: translateX(0); color: var(--fe-primary); }

/* ── Dark mode ───────────────────────────────────────────────────────────────── */
[data-theme="dark"] {
  --fe-bg-light:  #0D1B2A;
  --fe-text-dark: #E8ECF1;
  --fe-text-muted:#8899AA;
  --cream:        #0D1B2A;
  --ivory:        rgba(255,255,255,0.07);
  --charcoal:     #E8ECF1;
}
[data-theme="dark"] body { background: var(--fe-darker); color: var(--fe-text-light); }
[data-theme="dark"] .card { background: rgba(13,27,42,0.85); border-color: rgba(255,255,255,0.08); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
[data-theme="dark"] .card-header { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.07); }
[data-theme="dark"] .form-input, [data-theme="dark"] .form-textarea { background: rgba(255,255,255,0.04); color: var(--fe-text-light); border-color: rgba(255,255,255,0.10); }
[data-theme="dark"] .form-input:focus, [data-theme="dark"] .form-textarea:focus { border-color: var(--fe-primary); }
[data-theme="dark"] .topbar { background: var(--fe-dark); border-color: rgba(255,255,255,0.07); box-shadow: none; }
[data-theme="dark"] .main-layout { background: var(--fe-darker); }
[data-theme="dark"] .sidebar { background: #070F1B; }
[data-theme="dark"] .nav-item { color: var(--fe-text-dim); }
[data-theme="dark"] .nav-item:hover { color: var(--fe-text-light); background: rgba(94,174,247,0.06); }
[data-theme="dark"] .nav-item.active { color: var(--fe-accent); background: rgba(46,109,180,0.15); }
[data-theme="dark"] .btn-ghost { color: var(--fe-text-light); border-color: rgba(255,255,255,0.12); }
[data-theme="dark"] .btn-ghost:hover { background: rgba(255,255,255,0.06); }
[data-theme="dark"] select option { background: var(--fe-dark); color: var(--fe-text-light); }
[data-theme="dark"] .qa-ghost { background: rgba(255,255,255,0.05); color: var(--fe-text-light); border-color: rgba(255,255,255,0.12); }
[data-theme="dark"] .qa-ghost:hover { background: rgba(94,174,247,0.08); color: var(--fe-accent); border-color: rgba(94,174,247,0.30); }
[data-theme="dark"] .qa-primary { background: var(--fe-primary); color: #fff; }
[data-theme="dark"] .qa-success { background: #0f2818; color: #4ade80; border-color: #166534; }
[data-theme="dark"] .qa-success:hover { background: #142e1e; border-color: #4ade80; }
[data-theme="dark"] .qa-danger { background: #1f0e0e; color: #f87171; border-color: #7f1d1d; }
[data-theme="dark"] .qa-danger:hover { background: #2a1010; border-color: #f87171; }
[data-theme="dark"] .modal { background: var(--fe-dark); border: 1px solid rgba(255,255,255,0.10); }
[data-theme="dark"] .modal-header, [data-theme="dark"] .modal-footer { border-color: rgba(255,255,255,0.07); }
[data-theme="dark"] table.data-table th { background: rgba(255,255,255,0.03); color: var(--fe-text-dim); border-color: rgba(255,255,255,0.07); }
[data-theme="dark"] table.data-table td { border-color: rgba(255,255,255,0.06); color: var(--fe-text-light); }
[data-theme="dark"] table.data-table tr:hover td { background: rgba(94,174,247,0.04); }
[data-theme="dark"] .alert-warning { background: #1f1a0a; border-color: #6b4f1a; color: #e8c97a; }
[data-theme="dark"] .starter-card { background: rgba(13,27,42,0.7); border-color: rgba(255,255,255,0.08); }
[data-theme="dark"] .starter-card:hover { border-color: var(--fe-primary); background: rgba(46,109,180,0.08); }
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors (CSS changes don't affect TS).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: rewrite globals.css — FOREVENTOS tokens, Inter/Satoshi, navy palette"
```

---

## Task 4: Rebrand `components/Sidebar.tsx`

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Replace the logo area (lines 200–203)**

Find:
```tsx
      <div className="sidebar-logo">
        <span className="brand">Wedding Venues Spain</span>
        <span className="venue-name">{portalLabel}</span>
```

Replace with:
```tsx
      <div className="sidebar-logo">
        <img
          src="/foreventos-assets/LOGOMENUFONDOAZUL.png"
          alt="FOREVENTOS"
          style={{ height: 28, width: 'auto', display: 'block', marginBottom: 4 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
        <span className="venue-name">{portalLabel}</span>
```

- [ ] **Step 2: Replace role label "Administrador WVS"**

Find:
```tsx
  const roleLabel = isAdmin ? 'Administrador WVS'
```

Replace with:
```tsx
  const roleLabel = isAdmin ? 'Administrador FOREVENTOS'
```

- [ ] **Step 3: Replace all inline `var(--gold)` with `var(--fe-primary)`**

In `components/Sidebar.tsx`, replace every occurrence of `var(--gold)` with `var(--fe-primary)` and `'var(--gold)'` with `'var(--fe-primary)'`. Also replace `var(--stone)` with `var(--fe-text-dim)` and `var(--warm-gray)` with `var(--fe-text-muted)`.

Run in PowerShell from the worktree root:
```powershell
$file = "components\Sidebar.tsx"
$content = Get-Content $file -Raw
$content = $content -replace "var\(--gold\)", "var(--fe-primary)"
$content = $content -replace "'var\(--gold\)'", "'var(--fe-primary)'"
$content = $content -replace "var\(--stone\)", "var(--fe-text-dim)"
$content = $content -replace "var\(--warm-gray\)", "var(--fe-text-muted)"
$content = $content -replace "'Manrope, sans-serif'", "'Inter', sans-serif"
$content = $content -replace "'Manrope',\s*sans-serif", "'Inter', sans-serif"
$content | Set-Content $file -NoNewline
Write-Output "Done"
```

- [ ] **Step 4: Replace venue switcher + user menu dropdown backgrounds**

Find (venue switcher dropdown):
```tsx
                background: '#1e1a17', border: '1px solid rgba(255,255,255,0.12)',
```
Replace with:
```tsx
                background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.10)',
```

Find (user menu dropdown — same pattern appears twice, both `#1e1a17`):
```tsx
              background: '#1e1a17', border: '1px solid rgba(255,255,255,0.12)',
```
Replace with:
```tsx
              background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.10)',
```

- [ ] **Step 5: Update trial banner colors**

Find the trial banner (gold accent):
```tsx
            background: 'rgba(196,151,90,0.08)', border: '1px solid rgba(196,151,90,0.15)',
```
Replace with:
```tsx
            background: 'rgba(46,109,180,0.08)', border: '1px solid rgba(46,109,180,0.18)',
```

Find the "PASA A PREMIUM" banner (same pattern):
```tsx
            background: 'rgba(196,151,90,0.08)', border: '1px solid rgba(196,151,90,0.15)',
```
Replace with:
```tsx
            background: 'rgba(46,109,180,0.08)', border: '1px solid rgba(46,109,180,0.18)',
```

Find `color: 'var(--gold)'` in trial Hourglass icon and text:
```tsx
            <Hourglass size={11} style={{ color: 'var(--gold)', flexShrink: 0 }} />
```
Replace with:
```tsx
            <Hourglass size={11} style={{ color: 'var(--fe-accent)', flexShrink: 0 }} />
```

Find the TRIAL text color:
```tsx
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.04em' }}>TRIAL</div>
```
Replace with:
```tsx
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fe-accent)', letterSpacing: '0.04em' }}>TRIAL</div>
```

Find the "Activar →" span color:
```tsx
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--gold)', whiteSpace: 'nowrap' }}>Activar →</span>
```
Replace with:
```tsx
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--fe-accent)', whiteSpace: 'nowrap' }}>Activar →</span>
```

Find "PASA A PREMIUM" headline color:
```tsx
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.08em', marginBottom: 4 }}>PASA A PREMIUM</div>
```
Replace with:
```tsx
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fe-accent)', letterSpacing: '0.08em', marginBottom: 4 }}>PASA A PREMIUM</div>
```

- [ ] **Step 6: Update user menu "Mi perfil" active color**

Find:
```tsx
                color: pathname === '/perfil' ? 'var(--gold)' : '#fff',
```
Replace with:
```tsx
                color: pathname === '/perfil' ? 'var(--fe-accent)' : '#fff',
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 new errors.

- [ ] **Step 8: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: rebrand Sidebar — FOREVENTOS logo, navy palette, Inter font"
```

---

## Task 5: Update shared components

**Files:**
- Modify: `components/Spinner.tsx`
- Modify: `components/protectedroute.tsx`

- [ ] **Step 1: Update `components/Spinner.tsx`**

Replace entire file:
```typescript
'use client'

type Props = {
  size?: number
  color?: string
  thickness?: number
  style?: React.CSSProperties
}

export default function Spinner({ size = 24, color = 'var(--fe-primary)', thickness = 2, style }: Props) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      style={{
        width: size,
        height: size,
        border: `${thickness}px solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        ...style,
      }}
    />
  )
}

export function PageSpinner({ minHeight = '100vh', background }: { minHeight?: string | number; background?: string }) {
  return (
    <div style={{ minHeight, background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  )
}
```

- [ ] **Step 2: Update `components/protectedroute.tsx`**

Replace entire file:
```typescript
'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import Spinner from '@/components/Spinner'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace('/login')
    }
  }, [user, loading])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A1628' }}>
        <Spinner color="#5EAEF7" />
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
```

- [ ] **Step 3: Commit**

```bash
git add components/Spinner.tsx components/protectedroute.tsx
git commit -m "feat: update Spinner and ProtectedRoute — FOREVENTOS colours"
```

---

## Task 6: Global automated find-replace pass

**Files:** All `app/**/*.tsx` and `components/**/*.tsx`

This single task replaces all hardcoded WVS hex colours and font family strings across the entire codebase. The legacy CSS aliases in globals.css already handle `var(--gold)` etc., so this pass targets only hardcoded values.

- [ ] **Step 1: Run the replacement script**

Run in PowerShell from the worktree root:

```powershell
$base = "C:\Users\Guillermo\OneDrive\Escritorio\wvs-venue-portal\.claude\worktrees\focused-shtern-2174c1"
$files = Get-ChildItem -Path "$base\app", "$base\components" -Recurse -Include "*.tsx" | Select-Object -ExpandProperty FullName

$replacements = @(
  # Font families
  @{ From = "'Manrope', sans-serif";               To = "'Inter', sans-serif" },
  @{ From = "'Manrope',sans-serif";                To = "'Inter',sans-serif" },
  @{ From = "Manrope, sans-serif";                 To = "Inter, sans-serif" },
  @{ From = "Manrope,sans-serif";                  To = "Inter,sans-serif" },
  @{ From = "font-family: 'Manrope'";              To = "font-family: 'Inter'" },
  @{ From = "fontFamily: 'Manrope'";               To = "fontFamily: 'Inter'" },
  @{ From = "'Cormorant Garamond', serif";          To = "'Satoshi', 'Inter', sans-serif" },
  @{ From = "'Cormorant Garamond',serif";           To = "'Satoshi','Inter',sans-serif" },
  @{ From = "Cormorant Garamond";                   To = "Satoshi" },

  # Gold hex
  @{ From = "#C4975A";   To = "#2E6DB4" },
  @{ From = "#c4975a";   To = "#2E6DB4" },
  @{ From = "#b8894f";   To = "#2660a0" },
  @{ From = "#B8894F";   To = "#2660a0" },
  @{ From = "180,130,60";To = "46,109,180" },  # rgba gold components

  # Espresso / dark brown backgrounds
  @{ From = "#1A1512";   To = "#0A1628" },
  @{ From = "#1a1512";   To = "#0A1628" },
  @{ From = "#1e1a17";   To = "#0D1B2A" },
  @{ From = "#1E1A17";   To = "#0D1B2A" },
  @{ From = "#100e0b";   To = "#070F1B" },

  # Charcoal / dark text
  @{ From = "#2C2825";   To = "#1A1A2E" },
  @{ From = "#2c2825";   To = "#1A1A2E" },

  # Cream background
  @{ From = "#F7F3EE";   To = "#F4F6F8" },
  @{ From = "#f7f3ee";   To = "#F4F6F8" },

  # Ivory border
  @{ From = "#EFE9E0";   To = "rgba(0,0,0,0.08)" },
  @{ From = "#efe9e0";   To = "rgba(0,0,0,0.08)" },

  # Stone text
  @{ From = "#C8BDB0";   To = "#8899AA" },
  @{ From = "#c8bdb0";   To = "#8899AA" },

  # Brand text
  @{ From = "Wedding Venues Spain";  To = "FOREVENTOS" },
  @{ From = "wedding-venues-spain";  To = "foreventos" },

  # WVS logo URL (only the white-background portal logo)
  @{ From = "weddingvenuesspain.com/wp-content/uploads/2024/10/logo-wedding-venues-spain-white-e1732122540714.png"; To = "/foreventos-assets/LOGOMENUFONDOAZUL.png" }
)

$totalFiles = 0
$totalChanges = 0

foreach ($file in $files) {
  $content = Get-Content $file -Raw -Encoding UTF8
  $original = $content
  foreach ($r in $replacements) {
    $content = $content.Replace($r.From, $r.To)
  }
  if ($content -ne $original) {
    Set-Content $file $content -Encoding UTF8 -NoNewline
    $totalFiles++
    $totalChanges++
    Write-Output "Updated: $($file.Replace($base, ''))"
  }
}

Write-Output "`n--- Done: $totalFiles files updated ---"
```

- [ ] **Step 2: Verify no WVS gold hex remains**

```powershell
$base = "C:\Users\Guillermo\OneDrive\Escritorio\wvs-venue-portal\.claude\worktrees\focused-shtern-2174c1"
$remaining = Select-String -Path "$base\app\**\*.tsx", "$base\components\**\*.tsx" `
  -Pattern "#C4975A|#c4975a|#1A1512|#1a1512|#2C2825|#2c2825|#F7F3EE|#f7f3ee|Manrope|Cormorant Garamond" `
  -Recurse -CaseSensitive:$false |
  Where-Object { $_.Path -notlike "*node_modules*" -and $_.Path -notlike "*\.git*" }

if ($remaining) {
  Write-Output "REMAINING HITS:"
  $remaining | ForEach-Object { Write-Output "$($_.Filename):$($_.LineNumber) — $($_.Line.Trim())" }
} else {
  Write-Output "Clean — no WVS colours or fonts remain."
}
```

Expected: "Clean — no WVS colours or fonts remain." If there are hits, fix them manually and re-run the check.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors. If errors appear, they are pre-existing (not introduced by this task).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: global rebrand pass — replace WVS colours/fonts/brand text with FOREVENTOS"
```

---

## Task 7: Fix `app/canales/weddingvenuesspain/page.tsx` route branding

**Files:**
- Modify: `app/canales/weddingvenuesspain/page.tsx`

This file has "weddingvenuesspain" in its URL path (the route) and 101 WVS references. The route itself (`/canales/weddingvenuesspain`) represents the WeddingVenuesSpain channel integration — this is a functional channel name, not a brand display. Only the displayed text needs updating.

- [ ] **Step 1: Check what "Wedding Venues Spain" references remain in this file after Task 6**

```bash
grep -n "Wedding Venues Spain\|FOREVENTOS\|weddingvenuesspain" app/canales/weddingvenuesspain/page.tsx | head -30
```

- [ ] **Step 2: If any displayed text still says "Wedding Venues Spain" in UI labels (not variable names or API keys), replace them**

Search for any `>Wedding Venues Spain<` or similar JSX text nodes and replace with `>FOREVENTOS<` only where it appears as visible UI text (titles, labels, headings). Leave API endpoint strings, route names, and URL strings unchanged.

- [ ] **Step 3: Commit if changes made**

```bash
git add app/canales/weddingvenuesspain/page.tsx
git commit -m "feat: update channel page UI text — FOREVENTOS branding"
```

---

## Task 8: Proposal templates — client-facing pages (skip)

**Files:** `app/proposal/[slug]/tpl/T1Impacto.tsx`, `T2Emocion.tsx`, `T3TodoClaro.tsx`, `T4SocialProof.tsx`, `T5Minimalista.tsx`, `shared.tsx`, `app/para/[slug]/CoupleLandingClient.tsx`

These are **client-facing** proposal templates shown to couples (not portal UI). They have their own brand identity per venue. The automated pass in Task 6 has already replaced any literal "Wedding Venues Spain" text. No further rebrand needed here — these templates should remain visually neutral/venue-branded.

- [ ] **Step 1: Verify no visible "Wedding Venues Spain" text remains in proposal templates**

```bash
grep -n "Wedding Venues Spain\|WVS" app/proposal/[slug]/tpl/*.tsx app/para/[slug]/*.tsx 2>/dev/null | head -20
```

Expected: 0 hits. If hits found, check context — only fix if it's literal UI text, not a variable or comment.

---

## Task 9: Signup page — FOREVENTOS dark theme

**Files:**
- Modify: `app/signup/page.tsx`

The signup page should match the login page aesthetic (dark navy, stars, split layout or centered glass card).

- [ ] **Step 1: Read the current signup page**

```bash
head -80 app/signup/page.tsx
```

- [ ] **Step 2: Apply FOREVENTOS dark theme**

The signup page background should use `#0A1628` (fe-deep) and the form card should mirror the login card style (`rgba(255,255,255,0.04)` glass, `border-radius: 20px`). Replace any brown/gold inline styles found:

Run a targeted grep to find remaining WVS references:
```bash
grep -n "gold\|espresso\|Manrope\|#C4975A\|#1A1512\|cream\|ivory" app/signup/page.tsx
```

For each hit, replace:
- Brown backgrounds → `#0A1628` or `#0D1B2A`
- Gold colours → `#2E6DB4` or `#5EAEF7`
- Cream/ivory backgrounds → `#F4F6F8` or `rgba(255,255,255,0.04)`
- Font Manrope → Inter

Also update any page title text that says "Wedding Venues Spain" → "FOREVENTOS", and any logo src pointing to the WVS CDN → `/foreventos-assets/LOGOMENUFONDOAZUL.png`.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "signup" | head -10
```

Expected: no signup errors.

- [ ] **Step 4: Commit**

```bash
git add app/signup/page.tsx
git commit -m "feat: signup page — FOREVENTOS dark theme"
```

---

## Task 10: Pricing page — FOREVENTOS branding

**Files:**
- Modify: `app/pricing/page.tsx`

- [ ] **Step 1: Check remaining WVS references**

```bash
grep -n "gold\|espresso\|Manrope\|#C4975A\|#1A1512\|Wedding\|cream\|ivory\|Cormorant" app/pricing/page.tsx | head -30
```

- [ ] **Step 2: Fix any remaining hardcoded WVS styles**

For each hit from Step 1, apply the equivalent FOREVENTOS colour/font. Use:
- Accent colour: `#5EAEF7` (accent blue)
- Primary colour: `#2E6DB4`
- Background dark: `#0A1628`
- Background light: `#F4F6F8`
- Font: `'Inter', sans-serif` (body), `'Satoshi', 'Inter', sans-serif` (headlines)

The pricing page hero/CTA section should use the FOREVENTOS navy background. Plan cards should use white with blue-tinted shadow.

- [ ] **Step 3: Commit**

```bash
git add app/pricing/page.tsx
git commit -m "feat: pricing page — FOREVENTOS branding"
```

---

## Task 11: Onboarding + checkout pages

**Files:**
- Modify: `app/onboarding/page.tsx`
- Modify: `app/checkout/success/page.tsx`
- Modify: `app/checkout/error/page.tsx`

- [ ] **Step 1: Check remaining references in each file**

```bash
grep -n "gold\|espresso\|Manrope\|#C4975A\|#1A1512\|Wedding Venues\|cream\|ivory" \
  app/onboarding/page.tsx \
  app/checkout/success/page.tsx \
  app/checkout/error/page.tsx
```

- [ ] **Step 2: Apply FOREVENTOS colours to each hit**

Same substitution rules as Task 10. Onboarding progress steps should use `var(--fe-primary)` (#2E6DB4) for active/completed states.

- [ ] **Step 3: Commit**

```bash
git add app/onboarding/page.tsx app/checkout/success/page.tsx app/checkout/error/page.tsx
git commit -m "feat: onboarding + checkout pages — FOREVENTOS branding"
```

---

## Task 12: Component library audit — `components/` files

**Files:**
- Modify (as needed): `components/FeatureGate.tsx`, `components/DatePicker.tsx`, `components/InquiryForm.tsx`, `components/ProposalEditor.tsx`, `components/ProposalGate.tsx`, `components/TemplateEditor.tsx`, `components/VisitBookingModal.tsx`

- [ ] **Step 1: Check all components for remaining WVS refs**

```bash
grep -rn "gold\|espresso\|Manrope\|#C4975A\|#1A1512\|cream\|ivory\|Wedding Venues Spain" \
  components/ --include="*.tsx" | grep -v "node_modules"
```

- [ ] **Step 2: Fix each hit**

For each file with hits, apply the FOREVENTOS substitutions:
- `#C4975A` / `var(--gold)` → `#2E6DB4` / `var(--fe-primary)`  
- `#1A1512` / `var(--espresso)` → `#0A1628` / `var(--fe-deep)`
- `Manrope` → `Inter`
- `var(--cream)` → `var(--fe-bg-light)`
- `var(--ivory)` → `rgba(0,0,0,0.08)`

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add components/
git commit -m "feat: component library audit — remove remaining WVS refs"
```

---

## Task 13: Final verification pass

**Files:** Read-only audit

- [ ] **Step 1: Final grep — confirm zero WVS colour/font hits**

```powershell
$base = "C:\Users\Guillermo\OneDrive\Escritorio\wvs-venue-portal\.claude\worktrees\focused-shtern-2174c1"
Select-String -Path "$base\app\**\*.tsx", "$base\components\**\*.tsx" `
  -Pattern "#C4975A|#c4975a|#1A1512|#1a1512|#2C2825|#2c2825|#F7F3EE|#f7f3ee|#b8894f|Manrope|'Cormorant" `
  -Recurse | Where-Object { $_.Path -notlike "*node_modules*" -and $_.Path -notlike "*\.git*" } |
  ForEach-Object { Write-Output "$($_.Filename):$($_.LineNumber) — $($_.Line.Trim())" }
```

Expected: 0 hits.

- [ ] **Step 2: Final grep — confirm zero "Wedding Venues Spain" in UI**

```bash
grep -rn "Wedding Venues Spain" app/ components/ --include="*.tsx" | grep -v "node_modules"
```

Expected: 0 hits (or only inside comments/API strings that are not UI text).

- [ ] **Step 3: TypeScript check — clean build**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors.

- [ ] **Step 4: Push to origin + update PR**

```bash
git push
```

The existing PR (`claude/focused-shtern-2174c1`) already has the login + root redirect. Pushing adds the full rebrand to the same PR.

- [ ] **Step 5: Confirm PR is ready to merge**

```bash
gh pr view claude/focused-shtern-2174c1 --json url,title,state
```

---

## Success Checklist

- [ ] No "Wedding Venues Spain" visible in any portal page
- [ ] No brown/gold/espresso colours visible anywhere
- [ ] Sidebar shows FOREVENTOS logo on `#0A1628` navy background
- [ ] All CTAs and focus rings are `#2E6DB4` / `#5EAEF7`
- [ ] Inter used for body text, Satoshi for topbar titles and modal headings
- [ ] Browser favicon = FOREVENTOS favicon
- [ ] Browser tab title = "FOREVENTOS"
- [ ] Dark mode uses navy palette
- [ ] `/login` → FOREVENTOS login (done)
- [ ] `/` → redirects to login (done)
