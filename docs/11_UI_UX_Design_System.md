# Focus Flow: UI/UX Design System

*The real, currently-implemented visual language — verified against the actual `globals.css` tokens and `components/ui` primitives, not a target to migrate toward. Where something is a genuine gap (not yet decided), it's marked, not silently filled in.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md). This document answers *what things look and feel like*; [05_Information_Architecture.md](05_Information_Architecture.md) already answered *what pages exist*.

---

## Name and grounding

The system is called **Emerald Prestige** — chosen deliberately over a generic ed-tech palette (the pastel blues and rounded mascots most classroom software defaults to) because Focus Flow's actual users are teenagers and their teachers, not small children, and the brief has always asked for something that feels earned and substantial, not childish. Deep emerald and gold read as achievement and craft — closer to how a school actually wants its own brand to feel — rather than "friendly app for kids."

---

## Colors

All colors are CSS custom properties in `app/styles/globals.css`, consumed through Tailwind's `@theme inline` mapping — no component ever hardcodes a hex value; every one references a token (`bg-primary`, `text-muted-foreground`, etc.), so a future palette change is a one-file edit, not a find-and-replace across the codebase.

### Light (default)

| Token | Value | Used for |
|---|---|---|
| `background` | `#f5f0e0` (cream) | Page background |
| `foreground` | `#0f172a` | Default text |
| `card` | `#fbf9f2` | Card/surface background — slightly lighter than the page, not a hard white |
| `primary` | `#064e3b` (deep emerald) | Primary buttons, headings-as-brand-color contexts |
| `primary-foreground` | `#f5f0e0` | Text/icons on a primary-colored surface |
| `secondary` | `#eae2cb` | Secondary surfaces (badges, subtle fills) |
| `accent` | `#c9a84c` (gold) | The one deliberate accent — icons, focus rings, celebratory moments |
| `accent-foreground` | `#022c22` | Text on a gold surface |
| `muted-foreground` | `#78716c` | De-emphasized text (captions, metadata) |
| `destructive` | `#dc2626` | Delete/error actions |
| `border` / `input` | `#dcd3b4` | Hairlines, form field borders |

### Dark

Not an inversion — re-composed deliberately so gold does the job emerald does in light mode, since gold-on-dark-emerald reads as premium while emerald-on-dark-emerald would vanish:

| Token | Value | Used for |
|---|---|---|
| `background` | `#022c22` (near-black emerald) | Page background |
| `card` | `#064e3b` | Card/surface background |
| `primary` | `#c9a84c` (gold) | Primary buttons — swaps roles with light mode's emerald |
| `primary-foreground` | `#022c22` | Text/icons on a primary-colored surface |
| `accent` | `#c9a84c` | Same gold — the accent role never changes color, only what stands in for "primary" |
| `border` / `input` | `color-mix(in oklab, white 12%, transparent)` | Hairlines — computed relative to white, not a flat hex, so it stays legible across any dark surface it's drawn on |

**Chart colors** (`chart-1`–`chart-5`) are a five-step emerald/gold ramp in light mode, and a brighter, higher-contrast version of the same ramp in dark mode — used today only by `/progress`'s hand-rolled bar chart; any future chart (Class Trend Analytics, [H2](04_Product_Requirements_Document.md#h2-class-trend-analytics)) should draw from these same five tokens rather than introducing new chart-specific colors.

**The one rule that governs all of the above**: gold (`accent`) is spent deliberately and rarely — icons, focus rings, streak flames, celebration moments. It never becomes a background fill or body-text color; if gold is everywhere, it stops meaning "this matters."

---

## Typography

Two typefaces, self-hosted via `@fontsource` (never a Google Fonts CDN link — avoids both a privacy/tracking dependency and a render-blocking external request, consistent with the low-bandwidth constraint named throughout this document set):

- **Sora** (400/600/700/800) — the heading face (`font-heading`), applied automatically to every `h1`–`h6` via `globals.css`'s base layer. Geometric, confident, a little unusual — carries the "Emerald Prestige" personality.
- **Manrope** (400/500/600/700) — the body face (`font-sans`), applied to `body` by default. Warm and highly legible at small sizes, since a large share of real usage is a phone screen, not a desktop monitor.

No type scale is currently formalized as named tokens (`text-2xl`, `text-lg`, etc. are used ad hoc per component) — **this is a real gap**, not a deliberate choice, and is named here as an open question rather than backfilled with an invented scale that doesn't match what's actually in the codebase today.

---

## Spacing & Radius

Spacing follows Tailwind's default scale directly (no custom spacing tokens) — `gap-2`, `gap-4`, `px-6`, etc., chosen per-component rather than drawn from a Focus-Flow-specific scale. Layout composition uses flex/grid `gap`, not per-child margins, avoiding the classic collapsing/doubling-margin bug class.

**Radius** is the one place a real design token exists: `--radius: 0.75rem`, with `sm`/`md`/`lg`/`xl` all derived from it (`calc(var(--radius) - 4px)`, etc.) via the `@theme inline` block. Every rounded corner in the system — cards, buttons, dialogs, inputs — derives from this single value; changing the product's "roundedness" is a one-line edit.

---

## Buttons

Built on `class-variance-authority` (`cva`) over a Radix `Slot` primitive (`app/components/ui/button.tsx`). Six variants, eight sizes — a wider size range than most design systems ship with, because this one genuinely needs an `xs`/`icon-xs` pair for dense, mobile-first layouts (the sidebar's icon-only states, compact table actions):

| Variant | Use |
|---|---|
| `default` | The primary action on a screen — solid `primary` fill |
| `secondary` | A lower-emphasis but still real action |
| `outline` | Tertiary actions, cancel buttons |
| `ghost` | Icon-only or inline actions with no visible boundary until hovered |
| `destructive` | Delete/irreversible actions only |
| `link` | Text-styled, for inline navigation-like actions |

| Size | Height | Notes |
|---|---|---|
| `xs` / `icon-xs` | 24px | Dense contexts |
| `sm` / `icon-sm` | 32px | Secondary contexts |
| `default` / `icon` | 36px | Standard |
| `lg` / `icon-lg` | 40px | Primary calls-to-action, landing page |

---

## Cards & surfaces

A single `Card` primitive (`rounded-xl border bg-card shadow-sm`), composed with `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`/`CardAction` sub-parts — every stat tile, quiz row, and class tile in the product is this same primitive, never a bespoke bordered `div`. `StatCard` ([05_Information_Architecture.md](05_Information_Architecture.md)'s dashboard shell) is a thin, opinionated wrapper around it, not a separate visual language.

**`CardTitle` renders a `<div>`, not a heading tag** — a real, previously-hit testing gotcha (a Playwright selector assuming `h2` failed silently) worth repeating here since it affects both accessibility audits and test-writing: a screen reader does not announce a `CardTitle` as a heading today. **Open question**: should `CardTitle` render a real heading element for accessibility, with visual styling unaffected? Not decided here.

---

## Icons

**lucide-react**, exclusively — no other icon set anywhere in the codebase. Default size follows the button/badge component's own sizing (`size-4` inline, `size-3` inside badges), never a bespoke icon size chosen ad hoc per usage.

---

## Dark Mode

A hand-rolled `ThemeContext` (`app/features/theme/ThemeContext.tsx`), **not** the `next-themes` package that happens to sit in `package.json` as a dependency but is not actually used for this. The real mechanism: a `light`/`dark` string in `localStorage` (`focusflow-theme`), defaulting to the OS's `prefers-color-scheme` on first visit, applied by toggling a `.dark` class on `<html>` — which is exactly the selector `globals.css`'s `.dark { ... }` block and `@custom-variant dark` target.

**Open question worth resolving deliberately, not by accident:** `next-themes` sitting unused in `package.json` is either dead weight to remove, or a signal that this hand-rolled context was meant to be replaced by it and never was. Confirm which before adding any new theme-related feature (e.g., a system-follows-OS toggle, which `next-themes` handles natively).

---

## Motion

**Framer Motion** for all interface animation — page-section fade/slide-ins (`initial={{opacity:0, y:8}} → animate={{opacity:1,y:0}}`), staggered list entrances (`delay: index * 0.05`), the mobile nav drawer's spring-physics slide. This is the *only* animation library for ordinary UI; it is deliberately not used for the celebration layer.

**React Three Fiber / drei / three.js** is scoped exclusively to the celebration overlay (achievement unlocks, quiz completion, the live-game podium) — never used for ordinary page chrome. This is a deliberate boundary, not an oversight: 3D rendering is real work on the shared, low-RAM Android hardware this product is actually built for (see [00_Project_Philosophy.md](00_Project_Philosophy.md)), so it is spent only on the moments designed to feel like a genuine payoff, capped at `dpr={[1, 1.5]}` with `powerPreference: 'low-power'` and no HDR/environment maps or postprocessing.

**`prefers-reduced-motion` is not yet handled explicitly anywhere in the codebase** — a real, named gap. Every Framer Motion animation and the R3F celebration scene should respect it (reduced or skipped entirely), and this is flagged here as a concrete to-do for [16_Testing_Strategy.md]'s accessibility pass, not assumed already covered.

---

## Micro-interactions

- **Toasts** (Sonner) confirm every successful mutation (task created, quiz published, class joined) and surface every error — the only feedback channel today, since [08_System_Architecture.md](08_System_Architecture.md) already named the absence of any persistent notification system.
- **Loading states** are `animate-pulse` skeleton blocks sized to the content they'll be replaced by, not a generic spinner, in every list/dashboard view.
- **Disabled + spinning submit buttons** (`<LoaderCircle className="animate-spin" />` inline in the button) are the standard pattern for any in-flight mutation — never a full-page blocking overlay for a small action.

---

## Accessibility

**What's real today:**
- Focus-visible rings (`focus-visible:ring-[3px] focus-visible:ring-ring/50`) are built into the button/input primitives by default, not added per-instance.
- Radix primitives (Select, Dialog, DropdownMenu) carry their own real keyboard navigation and ARIA semantics for free, since the component library is built on Radix, not custom-rolled widgets.

**What's a named, real gap, not silently assumed handled:**
- `CardTitle` not being a real heading element (above).
- `prefers-reduced-motion` not being respected (above).
- No color-contrast audit has been run against the Emerald Prestige palette in either theme — the gold-on-cream and gold-on-dark-emerald combinations in particular should be checked against WCAG AA before this document's palette is treated as final.
- No systematic screen-reader pass has been done on the live game / celebration flows specifically, which are the most animation-heavy, least conventional parts of the UI.

---

## Component inventory (current)

Every primitive that exists today, for reference — anything not on this list does not exist yet and should be added here the moment it's built, not assumed covered by a similar-sounding one: `avatar`, `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `progress`, `select`, `separator`, `skeleton`, `sonner` (toast), `table`, `tabs`, `textarea`.

---

## Open questions carried into engineering

- Formalize a real type scale (named heading/body/caption sizes) instead of the current ad hoc per-component sizing.
- Resolve `next-themes`: remove it, or migrate the hand-rolled `ThemeContext` onto it.
- Decide whether `CardTitle` should render a real heading element.
- Run a real WCAG AA contrast check on both themes, especially the gold accent against both backgrounds.
- Implement `prefers-reduced-motion` handling across both Framer Motion and the R3F celebration layer.

---

**Next:** [12_Gamification_Framework.md] — the full XP/Mastery Path/Badge/Mission/Challenge system, one of the largest documents in this set per the founder's own framing, built on the visual language defined here.
