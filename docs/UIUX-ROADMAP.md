# ExamLegacy — Modern UI/UX, Typography & Glassmorphism Roadmap (v3)

> **STATUS: EXECUTED (2026-09-25)** — all 6 phases implemented, validated, and pushed
> as **one single delivery commit** (owner requested one-phase delivery — history squashed).
>
> Planning document — execution starts only after owner approval.
> Inspired by **Native Mobile Design & Apple HIG**, translated to a high-yield web PWA.

---

## 1. Modern Native Mobile Design Principles

Modern mobile application design focuses on **clarity, legibility, and refined tactile feedback**:

| # | Design Principle | Why It Matters | Implementation for Our Web App |
|---|------------------|----------------|--------------------------------|
| 1 | **Transparency & Intensity Control** (Clear → Tinted) | Users need legible text over content | Glass has a **tinted default** and solid fallbacks; never glass behind long body text |
| 2 | **Readability-First Corrections** — contrast, hairline borders | Excessive transparency reduces readability | Every glass surface = tint + hairline border + guaranteed contrast (4.5:1) |
| 3 | **Integrated Navigation** | Navigation must be predictable and intuitive | Bottom nav stays one predictable bar — fast, single-tap switching |
| 4 | **Subtle Depth & Tactile Hierarchy** | Interface elements need clear affordance | Icons and cards get clean subtle depth without decorative visual noise |
| 5 | **Reduced Header/Chrome Heights** | Maximize content visibility | Compact topbar/nav heights for high information density |
| 6 | **Fast Action Hubs** | Instant entry to primary user workflows | Store search and Study AI are first-class, one-tap entry points |
| 7 | **Standard Mobile Type Scale** (Display → Footnote), 8pt grid, 44pt tap targets | Professional design discipline | Clean scale discipline in CSS tokens with Outfit + system fallbacks |
| 8 | **Responsive Viewport Reflow** | Multi-device consistency | Fluid reflow handled by responsive tokens and zero desktop zoom lock |

Sources: Apple Developer "What's new in Design" (Jun 8 2026), WWDC 2026 coverage (Techtimes, Mashable, Orizon, Technet), Apple HIG-derived design system breakdown (superdesign.dev, 2026).

---

## 2. Current baseline (what we already have)

- Design tokens both themes (indigo `#4f46e5`, light `#f8fafc` / dark `#0b1020`)
- Font: **Outfit** only; no formal type scale
- Glass v1: `--glass-bg: rgba(255,255,255,.66)` + `blur(18px) saturate(180%)` on topbar/nav/sheets — good start, **one fixed intensity**, no fallback rules, no lensing details
- Motion: `--ease-spring`, `.screen-enter`, spring sheets, press-scale, celebration, reduced-motion block
- Blueprint v2.0.0 conformance shipped (`9cc1df9`), PWA shipped (`94cd823`)

---

## 3. MIND MAP

```
                        ┌─────────────────────────────────────────┐
                        │   MODERN UI/UX  v3  (Native Mobile Web) │
                        │   Clarity · Deference · Depth           │
                        └───────────────────┬─────────────────────┘
          ┌─────────────────┬───────────────┼───────────────┬──────────────────┐
          ▼                 ▼               ▼               ▼                  ▼
 ┌─────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌────────────────┐
 │  A. TYPOGRAPHY  │ │ B. GLASS-    │ │ C. DEPTH &   │ │ D. COMPONENT│ │ E. ACCESS &    │
 │     SYSTEM      │ │  MORPHISM    │ │   MOTION     │ │   REFRESH   │ │ PERFORMANCE    │
 └────────┬────────┘ └──────┬───────┘ └──────┬───────┘ └──────┬──────┘ └───────┬────────┘
          │                 │                │                │                │
   · Mobile scale     · tinted default   · z-layers      · topbar/nav     · contrast 4.5:1
     (34/28/22/20/      (NOT ultra-clear   (bg→surface→     (slimmer,     · 44px min taps
      17/16/15/          α .72 light /      glass→pop)       edge glass)   · reduced-transparency
      13/12 rem)          .55 dark)       · screen-enter  · cards: solid     = our own
   · display vs       · glass ONLY on      w/ stagger       + glass        intensity setting
     body pairing       chrome (topbar,   · spring sheets  · pills/CTAs:   · @supports fallback
   · weight            nav, sheets,       (340ms)           glassy           → solid surface
     hierarchy 400/     modals, toast)    · press .97      · inputs:      · backdrop-filter only
     500/600/700      · hairline inset     / .985           focus-glow      on FIXED chrome
   · tabular-nums       border + specular · PWA splash     · modals:       (scroll never re-blurs
     for ₹ prices       top highlight       glass frame       blur scrim      full page)
   · line-height      · @supports solid   · celebration   · VIP/promo   · 60fps budget:
     rhythm 1.5-1.6     fallback            shimmer          :pulse-glow     ≤5 glass surfaces
   · Outfit (display) + system fallback   · reduced-      · icons: layered · prefers-reduced-
     + system sans pairing                  motion full       light pass      motion honored
```

---

## 4. ROADMAP (6 phases, sequential, each self-verifiable)

### Phase 0 — Token foundation (design tokens v3)
- New type tokens: `--fs-display … --fs-caption` mapped to standard mobile scale (rem-based), `--lh-*`, `--fw-*`, `--tracking-*`
- Glass tokens v3: `--glass-tint`, `--glass-blur`, `--glass-border-hairline`, `--glass-specular`, plus **`--glass-intensity`** user knob (Clear ↔ Tinted)
- Spacing locked to 4/8pt grid multiples; radius scale unchanged
- **Deliverable:** tokens only, zero visual regression

### Phase 1 — Typography system
- Pair **Outfit** (display/headings) with system stack (`-apple-system, SF Pro…`) for body — high legibility on mobile devices, brand personality on headings
- Apply scale everywhere: screen titles (display), section titles (title2), body 17px/1.55, callout, footnote, caption
- `font-variant-numeric: tabular-nums` on all prices, credits, order IDs
- Measure/line-length cap ~68ch for chat + support text
- **Deliverable:** every screen re-typed; no layout breakage (visual pass all 8 journeys)

### Phase 2 — Glassmorphism integration
- Restyle glass surfaces with **lensing recipe**: tinted bg + `blur(20px) saturate(180%)` + hairline inset border + specular top highlight + soft outer shadow
- **Glass policy:**
  - ✅ glass on: topbar, bottom nav, sheets, modals/scrim, toasts, install card
  - ❌ never glass behind: body paragraphs, chat transcripts, prices, PDF controls
  - Content cards stay **solid** with soft shadow — glass is chrome, not content
  - Dark theme: darker tint + white hairline; light theme: white tint + cool hairline
  - `--glass-intensity` settings row (Appearance section in Account): Clear / Balanced / Tinted (default **Balanced**)
- **Deliverable:** both themes × both apps (SPA + admin chrome) restyled

### Phase 3 — Component refresh
- Topbar: slimmer (56→52px), edge-to-edge glass, gains tint on scroll (already transitioning — strengthen)
- Bottom nav: floating glass pill on scroll (safe-area aware), active tab = soft primary glow
- Buttons/CTAs: press-scale + inner specular; primary gradient subtle (indigo→violet)
- Cards: solid + 1px hairline + layered shadow; VIP pulse already there
- Inputs: focus ring glow (primary-soft), glass sheet forms (login/checkout) get lensing recipe
- Admin inherits same chrome language (keeps "Super Power" density)
- **Deliverable:** component library refreshed in `app.css` only (no JS changes expected)

### Phase 4 — Depth & motion polish
- Screen-enter already standard: add 30ms child stagger for lists (subtle)
- Sheet spring tuned + parallax-lite on hero images (transform-only, GPU safe)
- PWA splash gets one glass shimmer pass
- All motion under `prefers-reduced-motion` (extend existing block)

### Phase 5 — Accessibility & performance guardrails
- Contrast audit: every text/surface pair ≥ 4.5:1 (large 3:1) in BOTH themes — fix stragglers
- Tap targets ≥ 44px on interactive icons
- Firefox/older-browser fallback: `@supports not (backdrop-filter)` → solid tint (no broken blur)
- Perf rule: glass limited to fixed chrome → no per-frame blur on scroll content; verify 60fps scroll on mid Android + iPhone
- Reduced-transparency users (`prefers-contrast: more`) get auto-Tinted default

### Phase 6 — Validation & sign-off
- Visual regression pass: all 8 blueprint journeys, light+dark, mobile+desktop
- Browser matrix: Safari iOS (blur + `-webkit-` prefix), Chrome, Firefox fallback
- PWA re-verify (icons/manifest/SW unaffected); `node --check` + PHP heuristic + live curl
- Final commit + push + summary

---

## 5. Guardrails (what will NOT change)

- Blueprint v2.0.0 invariants: Study AI = chat-style; Support inside Account; nav = Home/Store/Study AI/Vault/Account
- PWA system, security headers, §3/§4 money/PDF invariants
- No new dependencies (no UI framework) — pure CSS/token work
- `screen-enter` on every dispatch, `EL.ui` contracts untouched
- Admin functionality identical — chrome refresh only

## 6. Estimated effort

| Phase | Size | Risk |
|-------|------|------|
| 0 Tokens | S | none |
| 1 Typography | M | low (layout shifts) |
| 2 Glass 2.0 | M | low-medium (contrast) |
| 3 Components | M | low |
| 4 Motion | S | low |
| 5 Access/Perf | S | none |
| 6 Validation | S | none |

All work executed by me on `arena/01a0d12f-e-commerce-app-with-ai`, phase-wise commits, checks green before each push.
