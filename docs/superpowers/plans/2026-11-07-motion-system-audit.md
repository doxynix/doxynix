# Motion System Audit & Remediation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every animation and transition in `apps/web` onto one motion contract — strong easing tokens, GPU-only properties, correct timing, interruptible exits, and a reduced-motion mode that is gentler instead of dead — closing all 50 findings from the audit below.

**Architecture:** One tiny TypeScript module (`src/shared/config/motion.ts`) is the canonical source of curves and durations. CSS mirrors it in `globals.css` and a drift test keeps them in sync. Every shared primitive (`shared/ui/core`, `shared/ui/kit`) is fixed once so downstream slices inherit the behaviour, then the app-level offenders (agent panel, repo map, charts, landing, dashboard) are fixed individually. Two guard tests — one for the CSS contract, one for the class contract across `shared/ui` — prevent regressions.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4.3.3, `tw-animate-css` 1.4.0, Radix UI, `motion` 14.9.0, `sonner` 2.0.8, Recharts, `@xyflow/react`, Vitest 5.0.5 + `@testing-library/react` + jsdom.

**Spec:** This document. §2 (Audit appendix) is the spec; every finding `F##` maps to exactly one task in §3.

## Global Constraints

- **Bun only.** Never `npm`, `yarn`, `pnpm`. Never introduce ESLint or Prettier — Biome (format) + Oxlint (lint) only.
- **Doppler is required** for `test`, `lint`, `type-check`, `build`. Locally the Doppler CLI must be installed and logged in; `CI=true` bypasses it.
- **Git is read-only for the executor.** Every task ends with a `git add` + `git commit` block. Treat those blocks as **documentation only**: do **not** run `git add`, `git commit`, `git reset`, `git stash`, `git checkout`, `git switch`, `git restore`, `git rebase`, `git merge`, `git clean` or any other mutating git command. Leave the working tree exactly as the edits leave it; the human reviews and commits.
- **Branch:** informational only — `fix/dxnx-<linear-number>-motion-system` (`fix/dxnx-motion-system` if there is no Linear issue). Do not create, switch or rename branches; work on whatever branch is already checked out.
- **Commit subject:** `type(scope): description`, ≤ 72 chars, no trailing period. Scope must be one of `ci cli config db deps root security shared siem-server skills tooling web`. Use `web` for this plan. **Never put the ticket in the subject** — the `prepare-commit-msg` hook appends `Closes DXNX-NNN` from the branch name.
- **Never `--no-verify`.** If a hook rejects a commit, fix the branch name or the message.
- **Comments:** default to none. A comment must explain *why*, not restate the code, and must fit 100 columns. Where this plan includes a comment, it is load-bearing — keep it.
- **Biome rewrites on write:** it sorts object keys, JSX props and imports. After every edit run `bun run format` in `apps/web` and re-read the file before continuing.
- **cspell** runs on staged files; any unusual word needs a `cspell.json` entry. This plan introduces none.
- **Reduced motion is not optional.** Every task that adds motion must leave `prefers-reduced-motion` and `data-reduce-motion` working. Tasks 3 and 12 are the enforcement tasks; do not skip them because "the CSS global rule covers it" — the global rule is what Task 3 rewrites to be gentler.
- **Do not touch generated files:** `apps/web/prisma/schema.prisma`, `apps/web/src/server/core/field-encryption/config.generated.ts`, `packages/shared/src/enums/index.ts`, `apps/web/messages/en.d.json.ts`. This plan touches none of them.
- **Verification commands** (run from repo root):

```bash
bun --filter @doxynix/web test src/shared/config/motion.test.ts
bun run format
bun run lint
bun run validate
```

---

## 1. File Map

| File | Responsibility | Created / Modified |
| --- | --- | --- |
| `apps/web/src/shared/config/motion.ts` | Canonical curves, durations, scales. Single source of truth. | **Create** |
| `apps/web/src/shared/config/motion.test.ts` | Unit test of the contract + drift check against `globals.css`. | **Create** |
| `apps/web/src/app/globals.css` | Tailwind theme overrides, `transition-standard`, keyframes, reduced-motion rules. | Modify |
| `apps/web/src/shared/ui/core/sheet.tsx` | Side drawer: timing, easing, overlay blur. | Modify |
| `apps/web/src/shared/ui/core/dialog.tsx` | Modal: overlay blur only (content timing already correct). | Modify |
| `apps/web/src/shared/ui/core/tooltip.tsx` | Origin-aware scale-in. | Modify |
| `apps/web/src/shared/ui/kit/app-tooltip.tsx` | Tooltip delay budget. | Modify |
| `apps/web/src/shared/ui/core/button.tsx` | Press feedback. | Modify |
| `apps/web/src/shared/ui/kit/copy-button.tsx` | Icon swap without `scale(0)`. | Modify |
| `apps/web/src/shared/ui/core/input-otp.tsx` | Kill `transition-all`. | Modify |
| `apps/web/src/shared/ui/core/command.tsx` | Command palette opens instantly. | Modify |
| `apps/web/src/shared/ui/core/sidebar.tsx` | Offcanvas slide on the compositor. | Modify |
| `apps/web/src/shared/lib/appearance-preferences.ts` | Theme view-transition curve. | Modify |
| `apps/web/src/shared/ui/core/animated-circular-progress-bar.tsx` | `transition: all`, 1s, paint-only animation. | Modify |
| `apps/web/src/shared/ui/core/trace.tsx` | Dead `motion-reduce:shimmer-none`. | Modify |
| `apps/web/src/shared/ui/visuals/shimmer-button.tsx` | Shadow hover without `transition-standard`. | Modify |
| `apps/web/src/shared/ui/visuals/marquee.tsx` | Broken `reverse` prop. | Modify |
| `apps/web/src/shared/ui/visuals/text-animate.variants.ts` | Enter/exit scales and curves. | Modify |
| `apps/web/src/shared/ui/visuals/animated-beam.tsx` | Reduced-motion guard. | Modify |
| `apps/web/src/shared/ui/visuals/background-beams-with-collision.tsx` | Reduced-motion guard. | Modify |
| `apps/web/src/features/agent/ui/agent.tsx` | Transform-only panel, single driver, reduced motion. | Modify |
| `apps/web/src/widgets/public-header/ui/public-header-wrapper.tsx` | Reduced-motion fallback. | Modify |
| `apps/web/src/features/repo-map/model/use-map-layout.ts` | Hover timing on edges. | Modify |
| `apps/web/src/features/repo-map/model/repo-map-hover.ts` | Hover timing on edges. | Modify |
| `apps/web/src/features/repo-map/ui/repo-node.tsx` | Hover dim timing. | Modify |
| `apps/web/src/features/repo-map/ui/repo-map.tsx` | Dead class removal, memoised controls. | Modify |
| `apps/web/src/features/repo-analytics/ui/repo-trends-chart.tsx` | Recharts animation off. | Modify |
| `apps/web/src/features/manage-subscription/ui/usage-forecast-chart.tsx` | Recharts animation off. | Modify |
| `apps/web/src/entities/repo/ui/repo-quality-radar.tsx` | Recharts animation off. | Modify |
| `apps/web/src/entities/repo/ui/repo-complexity-scatter-chart.tsx` | Recharts animation off. | Modify |
| `apps/web/src/features/repo-docs-viewer/ui/repo-docs-content.tsx` | 500 ms → 200 ms. | Modify |
| `apps/web/src/entities/repo/ui/repo-status-bar.tsx` | Idle pulse removed. | Modify |
| `apps/web/src/entities/repo/ui/repo-analytics-cards.tsx` | Idle pulse removed. | Modify |
| `apps/web/src/shared/ui/core/code-block.tsx` | Missing hover transition. | Modify |
| `apps/web/src/shared/ui/kit/docs-heading.tsx` | Missing hover transition. | Modify |
| `apps/web/src/entities/repo/ui/repo-card.tsx` | Missing hover transition. | Modify |
| `apps/web/src/shared/ui/motion-policy.test.ts` | Class-contract guard across `shared/ui`. | **Create** |

Each `*.motion.test.ts` file created by a task sits next to the file it guards.

---

## 2. Audit Appendix (the spec)

Severity: **HIGH** = feels wrong or breaks a hard rule; **MED** = noticeably off; **LOW** = polish or dead code.

### 2.1 Systemic tokens

| ID | Severity | Location | Finding | Fix |
| --- | --- | --- | --- | --- |
| F01 | HIGH | `globals.css:123-128` | `transition-standard` uses `cubic-bezier(0.4, 0, 0.2, 1)` — the weak Material curve — in **75 call sites** | `cubic-bezier(0.23, 1, 0.32, 1)` via `--ease-out` |
| F02 | MED | `globals.css:126-127` | `transition-property` includes `box-shadow` (paint) and duplicates `transform` + `translate/rotate/scale` | Explicit list without `box-shadow` |
| F03 | HIGH | `globals.css`, `appearance-preferences.ts:242`, `repo-swagger.tsx:89`, `globals.css:1037`, `text-animate.variants.ts:42`, `animated-theme-toggler.tsx:91` | **Six** parallel easing systems; bare `transition-*` utilities fall back to Tailwind's weak default | One `@theme` block + `--default-transition-timing-function` |
| F04 | MED | `globals.css` | No duration scale; every call site hardcodes `duration-*` | `DURATION` constants in `motion.ts`, mirrored as CSS comments |
| F05 | MED | `globals.css:232-233` | `fade-in` 350 ms / `fade-out` 350 ms, above the 300 ms UI budget | 200 ms / 150 ms on `--ease-out` |

### 2.2 Reduced motion and accessibility

| ID | Severity | Location | Finding | Fix |
| --- | --- | --- | --- | --- |
| F06 | HIGH | `globals.css:715-722`, `globals.css:894-906` | Reduced motion sets `transition-duration: 0.01ms` on `*` — kills *all* feedback, including colour and opacity. The skill requires "fewer and gentler", not zero | Restrict `transition-property` to colour/opacity at 120 ms; stop infinite decorative loops |
| F07 | MED | `agent.tsx`, `public-header-wrapper.tsx`, `text-animate.tsx`, `animated-beam.tsx`, `background-beams-with-collision.tsx` | Motion components ignore `useReducedMotion()` | Guard each |
| F08 | LOW | `trace.tsx:60` | `motion-reduce:shimmer-none` — there is no `shimmer-none` utility, so the class is a no-op | Delete it; the global rule in F06 handles it |
| F09 | — | Everywhere | Hover gating — Tailwind v4 wraps `hover:` and `group-hover:` in `@media (hover: hover)` by default. **No action.** | — |

### 2.3 Shared primitives (`shared/ui`)

| ID | Severity | Location | Finding | Fix |
| --- | --- | --- | --- | --- |
| F10 | HIGH | `sheet.tsx:93` | `data-[state=closed]:ease-in` — `ease-in` on a UI exit delays the exact moment the user watches. Also close 300 ms > open 400 ms is inverted | Open 300 ms `ease-out-expo`, close 200 ms `ease-out` |
| F11 | MED | `dialog.tsx:50`, `sheet.tsx:63` | Full-viewport `backdrop-blur-sm` on an overlay that is simultaneously fading — `backdrop-filter` repaints the viewport every frame | Drop blur from the animating overlay; keep the scrim |
| F12 | MED | `tooltip.tsx:48-53` | No `transform-origin`; tooltip scales from its centre while popover/dropdown/select are origin-aware | `origin-(--radix-tooltip-content-transform-origin)` |
| F13 | — | `button.tsx:8,22` | No `:active` press feedback. A `0.97` press scale was implemented, then **reversed after human review** — it read as odd in the product. | `active:shadow-none` stays; no press scale. Absence is guarded by `button.motion.test.ts` |
| F14 | MED | `copy-button.tsx:66,73` | `scale-0` entrance — "nothing appears from nothing" | `scale-90` + opacity |
| F15 | LOW | `input-otp.tsx:53` | `transition-all` | Explicit property list |
| F16 | MED | `sidebar.tsx:337,350` | Offcanvas collapse animates `left`/`right` (layout) at 300 ms | `translate-x` (compositor) + keep `width` |
| F17 | — | `command.tsx:42` → `dialog.tsx:74` | `Ctrl+K` palette inherited the full 300 ms modal zoom. An `animated={false}` opt-out was added, then **reversed on request** — the palette keeps the standard dialog animation | No opt-out; the `animated` prop was removed and `command.motion.test.ts` deleted |
| F18 | — | `accordion.tsx:49`, `trace.tsx:126` | Height keyframes for accordions are the one tolerated layout animation | **No action** |
| F19 | MED | `animated-circular-progress-bar.tsx:72,95-97` | `transition: all` inline; 1 s; animates `stroke-dasharray` (paint) | `stroke-dasharray` only, 400 ms, token curve |
| F20 | — | `scroll-area.tsx:37-39`, `switch.tsx`, `slider.tsx`, `calendar.tsx` | Colour/transform only, sane durations | **No action** |
| F21 | LOW | `navigation-menu.tsx:104` | `zoom-in-90` and `origin-top` — at the low edge of the 0.9–0.97 band, origin approximated by the viewport anchor | **No action**, documented |
| F22 | LOW | `mermaid.tsx:177` | 300 ms fade on image mount — at the budget limit | 200 ms |
| F23 | LOW | `app-tooltip.tsx:25` | Default `delay = 400 ms`, longer than Radix's 300 ms default; subsequent tooltips already inherit `skipDelayDuration` | 300 ms |

### 2.4 App surfaces

| ID | Severity | Location | Finding | Fix |
| --- | --- | --- | --- | --- |
| F24 | HIGH | `agent.tsx:322-345` | Motion animates `top`, `bottom`, `right` — layout properties — on a 450 ms tween | Fade + 8 px slide, geometry snaps; 200 ms |
| F25 | HIGH | `agent.tsx:313` + `322` | Two competing drivers on one element: CSS `transition-[left] 300ms` and Motion on `top/right/bottom` | One driver; keep `left` transition documented as a bounded exception |
| F26 | MED | `agent.tsx` | No `useReducedMotion()` | Guard |
| F27 | HIGH | `repo-trends-chart.tsx`, `usage-forecast-chart.tsx`, `repo-quality-radar.tsx`, `repo-complexity-scatter-chart.tsx` | Recharts defaults to a 1500 ms draw animation on every mount — functional data moving for style | `isAnimationActive={false}` |
| F28 | MED | `use-map-layout.ts:76`, `repo-map-hover.ts:27`, `repo-node.tsx:124` | 300 ms `ease-in-out` opacity on hover of a dependency graph — the user is reading this surface | 120 ms `ease-out` |
| F29 | LOW | `repo-map.tsx:237` | `transition-opacity duration-300` on a wrapper whose opacity never changes — dead class | Delete |
| F30 | MED | `repo-docs-content.tsx:405` | `duration-500` on content swap | 200 ms |
| F31 | LOW | `repo-status-bar.tsx:33`, `repo-analytics-cards.tsx:222` | `animate-pulse` on static status icons — idle motion on a signal the user reads | Remove |
| F32 | — | `code-block.tsx:75`, `docs-heading.tsx:41`, `repo-card.tsx:81` | Re-checked after the first pass: all three already carry `transition-opacity`. **No action.** | — |
| F33 | MED | `public-header-wrapper.tsx:39-60` | No reduced-motion path; slides `y: -100%` | `useReducedMotion()` → opacity only |
| F34 | LOW | `globals.css:1017-1023` | Marquee duplicated 4× with `will-change: transform` — four compositor layers for one strip | Keep (needed for the loop), no action |
| F35 | LOW | `marquee.tsx:42` | `direction-[reverse]` is not valid CSS (`direction` accepts only `ltr`/`rtl`); the `reverse` prop does nothing | `[animation-direction:reverse]` |
| F36 | LOW | `text-animate.variants.ts:168,187,42` | `scaleUp` enters from `scale: 0.5`, `scaleDown` from `1.5`; `EXIT_EASING` is `ease-in` | `0.92` / `1.08`; exit `ease-out` |
| F37 | LOW | `hero-section.tsx:19,58,67` | `animate-fade-in` (now 200 ms) and an infinite `animate-float` on the scroll CTA | Float allowed on landing (delight budget); no action beyond F05 |
| F38 | — | `welcome-flow.tsx:22`, `product-preview.tsx:28` | `useReducedMotion() || preferences.reduceMotion`, 200–220 ms, `easeOut` | **Reference implementation.** No action |
| F39 | — | `sonner.tsx` + `layout.tsx:170` | One `Toaster` at the root, theme wired, custom icons, `top-center`, swipe directions derived | **No action** — verified correct |
| F40 | LOW | `appearance-preferences.ts:242` | Theme-change view transition uses `cubic-bezier(0.25, 0.8, 0.25, 1)` | Shared `ease-out` token |
| F41 | LOW | `repo-swagger.tsx:89` | Inline `--scalar-transition-curve: cubic-bezier(0.4, 0, 0.2, 1)` | Shared `ease-out` literal |
| F42 | LOW | `globals.css:1037` | `skeleton-pulse` uses the Material curve | `--ease-in-out` |
| F43 | — | `resizable.tsx`, `slider.tsx` | Drag surfaces have no custom animation | **No action** |
| F44 | — | `NextTopLoader` (`layout.tsx:175`) | Third-party width-based progress bar, `showSpinner={false}` | **No action** |
| F45 | — | `dialog.tsx:74` | Open 300 / close 200 + `ease-out-expo` + `zoom-in-95` + centred modal | **Reference implementation.** No action |
| F46 | — | `popover.tsx:22`, `dropdown-menu.tsx:47,231`, `select.tsx:70` | Origin-aware, `zoom-in-95`, directional slides | **Reference implementation.** No action |
| F47 | — | `theme-transition.ts` | Pure geometry helper, no motion primitives | **No action** |
| F48 | — | `about/page.tsx:111` | `active:scale-95` — removed on request together with the shared button's press scale | No press scale anywhere in `src` |
| F49 | LOW | `support/page.tsx:119`, `bento-grid.tsx:57-100`, `brands-section.tsx:46` | Hover translate/scale on marketing pages, Tailwind-gated, 300 ms | **No action** — occasional surface, gates already correct |
| F50 | MED | `globals.css` (whole file) | No regression guard: nothing stops the weak curve or `ease-in` from coming back | Tasks 1–2 add the contract; Tasks 18–19 add two guards |

---

## 3. Tasks

### Task 1: Motion contract module

**Files:**
- Create: `apps/web/src/shared/config/motion.ts`
- Test: `apps/web/src/shared/config/motion.test.ts`

**Interfaces:**
- Produces: `EASING` (`{ out, inOut, drawer, expoOut }`, each a readonly 4-tuple), `DURATION` (`{ chart, dropdown, hoverDim, modalClose, modalOpen, press, tooltip, ui }`, milliseconds), `SCALE` (`{ enter, press }`). Every later task imports from here instead of hardcoding a curve.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/shared/config/motion.test.ts
import { describe, expect, it } from "vitest";

import { DURATION, EASING, SCALE } from "./motion";

describe("motion contract", () => {
  it("keeps every curve inside the 0..1 control-point box", () => {
    for (const curve of [EASING.out, EASING.inOut, EASING.drawer, EASING.expoOut]) {
      expect(curve).toHaveLength(4);
      expect(curve.every((n) => n >= 0 && n <= 1)).toBe(true);
    }
  });

  it("keeps UI durations inside the 300ms budget", () => {
    expect(DURATION.press).toBeLessThanOrEqual(160);
    expect(DURATION.ui).toBeLessThanOrEqual(200);
    expect(DURATION.tooltip).toBeLessThanOrEqual(200);
    expect(DURATION.dropdown).toBeLessThanOrEqual(250);
    expect(DURATION.modalOpen).toBeLessThanOrEqual(300);
    expect(DURATION.modalClose).toBeLessThanOrEqual(250);
    expect(DURATION.hoverDim).toBeLessThanOrEqual(150);
    expect(DURATION.chart).toBe(0);
  });

  it("keeps entrance scales off zero", () => {
    expect(SCALE.enter).toBeGreaterThanOrEqual(0.9);
    expect(SCALE.enter).toBeLessThanOrEqual(0.97);
    expect(SCALE.press).toBeGreaterThanOrEqual(0.95);
    expect(SCALE.press).toBeLessThanOrEqual(0.98);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/config/motion.test.ts`
Expected: FAIL — `Failed to resolve import "./motion"`.

- [ ] **Step 3: Write the module**

```ts
// apps/web/src/shared/config/motion.ts
// Mirrored by the tokens in src/app/globals.css; motion.test.ts fails when the two drift.
export const EASING = {
  drawer: [0.32, 0.72, 0, 1],
  expoOut: [0.16, 1, 0.3, 1],
  inOut: [0.77, 0, 0.175, 1],
  out: [0.23, 1, 0.32, 1],
} as const;

export const DURATION = {
  chart: 0,
  dropdown: 180,
  hoverDim: 120,
  modalClose: 200,
  modalOpen: 300,
  press: 120,
  tooltip: 150,
  ui: 150,
} as const;

export const SCALE = {
  enter: 0.95,
  press: 0.97,
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/config/motion.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/shared/config/motion.ts apps/web/src/shared/config/motion.test.ts
git commit -m "feat(web): add canonical motion contract module"
```

---

### Task 2: Global token layer and drift guard

Closes F01, F02, F03, F04, F05, F42, F50 (partially).

**Files:**
- Modify: `apps/web/src/app/globals.css:123-128` (`transition-standard`), `:215-242` (`@theme`), `:232-233` (fade tokens), `:1036-1038` (skeleton), `:684-693` (appearance transition)
- Modify: `apps/web/src/shared/ui/visuals/shimmer-button.tsx:44`
- Modify: `apps/web/src/shared/ui/core/navigation-menu.tsx:59`
- Test: `apps/web/src/shared/config/motion.test.ts` (append)

**Interfaces:**
- Consumes: `EASING`, `DURATION` from Task 1.
- Produces: CSS variables `--ease-out`, `--ease-in-out`, `--ease-drawer`; a `transition-standard` utility whose curve is the strong ease-out; `--default-transition-timing-function` so bare `transition-colors` etc. stop using the Material curve.

- [ ] **Step 1: Extend the test with the CSS drift assertions**

Append to `apps/web/src/shared/config/motion.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

const cubic = (values: readonly number[]) => `cubic-bezier(${values.join(", ")})`;

describe("globals.css mirrors the motion contract", () => {
  it("declares the strong ease-out curve", () => {
    expect(css).toContain(`--ease-out: ${cubic(EASING.out)}`);
  });

  it("declares the ease-in-out and drawer curves", () => {
    expect(css).toContain(`--ease-in-out: ${cubic(EASING.inOut)}`);
    expect(css).toContain(`--ease-drawer: ${cubic(EASING.drawer)}`);
  });

  it("routes bare transitions through the strong curve", () => {
    expect(css).toContain(`--default-transition-timing-function: ${cubic(EASING.out)}`);
  });

  it("does not animate box-shadow by default", () => {
    const utility = css.slice(css.indexOf("@utility transition-standard"));
    const propertyList = utility.slice(0, utility.indexOf("}"));
    expect(propertyList).not.toContain("box-shadow");
  });

  it("keeps the fade entrances inside the budget", () => {
    expect(css).toContain("--animate-fade-in: fade-in 200ms");
    expect(css).toContain("--animate-fade-out: fade-out 150ms");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/config/motion.test.ts`
Expected: FAIL — 5 failing assertions (`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` not found, `box-shadow` present in the utility).

- [ ] **Step 3: Add the tokens to `@theme`**

In `apps/web/src/app/globals.css`, inside the existing `@theme { ... }` block, directly after the `--ease-out-expo` line, insert:

```css
  /* Motion contract, mirrored from src/shared/config/motion.ts */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

  --default-transition-duration: 150ms;
  --default-transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
```

- [ ] **Step 4: Rewrite `transition-standard`**

Replace the whole utility at `globals.css:123-128`:

```css
@utility transition-standard {
  transition-property: color, background-color, border-color, outline-color, opacity, transform;
  transition-timing-function: var(--tw-ease, var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1)));
  transition-duration: var(--tw-duration, 150ms);
}
```

`var(--tw-ease, …)` is deliberate: it keeps `transition-standard ease-out-expo duration-300` working in `auth-form.tsx:316,371,504,577`.

- [ ] **Step 5: Fix the fade keyframes and the skeleton curve**

Replace `globals.css:232-233`:

```css
  --animate-fade-in: fade-in 200ms var(--ease-out) forwards;
  --animate-fade-out: fade-out 150ms var(--ease-out) forwards;
```

Replace the `.animate-skeleton-pulse` animation at `globals.css:1037`:

```css
    animation: skeleton-pulse 1.8s var(--ease-in-out) infinite;
```

- [ ] **Step 6: Route the appearance transition through the token**

In the `[data-appearance-transition]` block at `globals.css:684-693`, change:

```css
  transition-timing-function: ease-out !important;
```

to:

```css
  transition-timing-function: var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1)) !important;
```

- [ ] **Step 7: Opt the two shadow hovers out of `transition-standard`**

`apps/web/src/shared/ui/visuals/shimmer-button.tsx:44` — replace `transition-standard` with:

```
transition-[color,background-color,border-color,box-shadow] duration-150 ease-out
```

`apps/web/src/shared/ui/core/navigation-menu.tsx:59` — same replacement.

Rationale for not keeping `box-shadow` in the shared utility: it repaints the element every frame on hover, and only these two components animate a shadow. Everywhere else the property list is now paint-free.

- [ ] **Step 8: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/config/motion.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 9: Verify in the browser**

Run `bun run dev`, open the dashboard, and confirm a card border hover and a button hover both feel snappier than before. In DevTools → Animations, set playback to 10% and confirm the two hovers use a curve that moves immediately rather than easing in.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/shared/config/motion.test.ts apps/web/src/shared/ui/visuals/shimmer-button.tsx apps/web/src/shared/ui/core/navigation-menu.tsx
git commit -m "fix(web): centralise easing tokens and fix transition-standard curve"
```

---

### Task 3: Reduced motion becomes gentler, not dead

Closes F06, F08.

**Files:**
- Modify: `apps/web/src/app/globals.css:715-722` (attribute block), `:894-906` (media block)
- Modify: `apps/web/src/shared/ui/core/trace.tsx:60`
- Test: `apps/web/src/shared/config/motion.test.ts` (append)

**Interfaces:**
- Produces: a reduced-motion mode that keeps 120 ms colour/opacity transitions, freezes decorative loops, and keeps spinners legible. Task 19's policy test asserts the 0.01 ms rule never returns.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/shared/config/motion.test.ts`:

```ts
describe("reduced motion", () => {
  it("never collapses every transition to 0.01ms", () => {
    expect(css).not.toMatch(/transition-duration:\s*0\.01ms/);
  });

  it("keeps colour and opacity transitions under reduced motion", () => {
    expect(css).toContain(
      "transition-property: color, background-color, border-color, outline-color, opacity !important;",
    );
    expect(css).toContain("transition-duration: 120ms !important;");
  });

  it("stops the decorative loops", () => {
    expect(css).toContain(".animate-marquee");
    expect(css).toContain(".shimmer");
    expect(css).toContain("animation: none !important;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/config/motion.test.ts`
Expected: FAIL — `transition-duration: 0.01ms` still present.

- [ ] **Step 3: Replace the attribute block**

Replace `globals.css:715-722` entirely:

```css
:root[data-reduce-motion] *,
:root[data-reduce-motion] *::before,
:root[data-reduce-motion] *::after {
  scroll-behavior: auto;
  transition-property: color, background-color, border-color, outline-color, opacity !important;
  transition-duration: 120ms !important;
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
}

:root[data-reduce-motion] :is(
    .shimmer,
    .animate-marquee,
    .animate-marquee-vertical,
    .animate-shimmer-slide,
    .animate-spin-around,
    .animate-float,
    .animate-skeleton-pulse
  ) {
  animation: none !important;
}

:root[data-reduce-motion] .animate-spin {
  animation-duration: 1.2s !important;
  animation-iteration-count: infinite !important;
}
```

- [ ] **Step 4: Replace the media block**

Replace the `@media (prefers-reduced-motion: reduce)` block at `globals.css:894-913` body with the same three rule sets, using `*`, `::before`, `::after` instead of the attribute selectors:

```css
  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }

    *,
    ::before,
    ::after {
      scroll-behavior: auto;
      transition-property: color, background-color, border-color, outline-color, opacity !important;
      transition-duration: 120ms !important;
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
    }

    :is(
        .shimmer,
        .animate-marquee,
        .animate-marquee-vertical,
        .animate-shimmer-slide,
        .animate-spin-around,
        .animate-float,
        .animate-skeleton-pulse
      ) {
      animation: none !important;
    }

    .animate-spin {
      animation-duration: 1.2s !important;
      animation-iteration-count: infinite !important;
    }

    ::view-transition-group(*),
    ::view-transition-old(*),
    ::view-transition-new(*) {
      animation: none;
    }
  }
```

- [ ] **Step 5: Delete the dead utility in `trace.tsx`**

`apps/web/src/shared/ui/core/trace.tsx:60` — change:

```tsx
className={cn("min-w-0 truncate motion-reduce:shimmer-none", className)}
```

to:

```tsx
className={cn("min-w-0 truncate", className)}
```

`shimmer-none` does not exist in Tailwind or `tw-animate-css`; the global rule above replaces it.

- [ ] **Step 6: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/config/motion.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 7: Verify manually**

Turn on **Settings → Appearance → Reduce motion**, then:
1. Hover a sidebar link — colour should still ease over ~120 ms, not snap.
2. Open a dropdown — it should appear without zooming.
3. Run a repo analysis and confirm the skeleton does not pulse.
OS-level check: enable "Reduce motion" in the OS and repeat 1–3.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/shared/ui/core/trace.tsx apps/web/src/shared/config/motion.test.ts
git commit -m "fix(web): make reduced motion gentler instead of disabling all feedback"
```

---

### Task 4: Overlay timing and backdrop-filter cost

Closes F10, F11.

**Files:**
- Modify: `apps/web/src/shared/ui/core/sheet.tsx:63,93`
- Modify: `apps/web/src/shared/ui/core/dialog.tsx:50`
- Test: `apps/web/src/shared/ui/core/sheet.motion.test.ts` (**create**)

**Interfaces:**
- Produces: sheet opens in 300 ms `ease-out-expo`, closes in 200 ms `ease-out`; overlays no longer animate `backdrop-filter`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/shared/ui/core/sheet.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("sheet and dialog motion", () => {
  it("never uses ease-in on the sheet exit", () => {
    expect(read("src/shared/ui/core/sheet.tsx")).not.toMatch(/data-\[state=closed\]:ease-in\b/);
  });

  it("closes the sheet faster than it opens", () => {
    const sheet = read("src/shared/ui/core/sheet.tsx");
    expect(sheet).toContain("data-[state=open]:duration-300");
    expect(sheet).toContain("data-[state=closed]:duration-200");
  });

  it("does not animate a blurred overlay", () => {
    expect(read("src/shared/ui/core/sheet.tsx")).not.toContain("backdrop-blur-sm");
    expect(read("src/shared/ui/core/dialog.tsx")).not.toContain("backdrop-blur-sm");
  });

  it("gives the dialog overlay a scrim instead of blur", () => {
    expect(read("src/shared/ui/core/dialog.tsx")).toContain("bg-overlay");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/ui/core/sheet.motion.test.ts`
Expected: FAIL — all four assertions.

- [ ] **Step 3: Fix the sheet content timing**

`apps/web/src/shared/ui/core/sheet.tsx:93` — replace the timing fragment

```
data-[state=closed]:duration-300 data-[state=open]:duration-400 data-[state=closed]:ease-in data-[state=open]:ease-out-expo
```

with

```
data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=closed]:ease-out data-[state=open]:ease-out-expo
```

- [ ] **Step 4: Remove blur from both overlays**

`sheet.tsx:63` — delete `backdrop-blur-sm` from the class list (keep `bg-overlay/85`).

`dialog.tsx:50` — delete `backdrop-blur-sm` and add `bg-overlay`:

```tsx
"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=open]:animate-in",
```

`--overlay` already carries its own alpha (`oklch(0.132 0.004 255 / 0.44)`), so the scrim reads the same without paying for a per-frame `backdrop-filter` over the whole viewport.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/ui/core/sheet.motion.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verify manually**

Open a sheet (audit-log panel) and a dialog. Both should still dim the page. In DevTools → Performance, record while opening a dialog and confirm there is no `backdrop-filter` entry in the rendering track.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/shared/ui/core/sheet.tsx apps/web/src/shared/ui/core/dialog.tsx apps/web/src/shared/ui/core/sheet.motion.test.ts
git commit -m "fix(web): correct sheet exit easing and drop blurred overlays"
```

---

### Task 5: Origin-aware tooltips

Closes F12, F23.

**Files:**
- Modify: `apps/web/src/shared/ui/core/tooltip.tsx:48-53`
- Modify: `apps/web/src/shared/ui/kit/app-tooltip.tsx:25`
- Test: `apps/web/src/shared/ui/core/tooltip.motion.test.ts` (**create**)

**Interfaces:**
- Consumes: nothing.
- Produces: tooltips that scale out of their trigger, matching popover/dropdown/select.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/shared/ui/core/tooltip.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("tooltip motion", () => {
  it("scales from the trigger, not the centre", () => {
    expect(read("src/shared/ui/core/tooltip.tsx")).toContain(
      "origin-(--radix-tooltip-content-transform-origin)",
    );
  });

  it("does not enter from scale zero", () => {
    expect(read("src/shared/ui/core/tooltip.tsx")).not.toContain("zoom-in-0");
  });

  it("uses a 300ms default delay so adjacent tooltips feel immediate", () => {
    expect(read("src/shared/ui/kit/app-tooltip.tsx")).toContain("delay = 300");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/ui/core/tooltip.motion.test.ts`
Expected: FAIL — origin class and `delay = 300` missing.

- [ ] **Step 3: Add the origin class**

`tooltip.tsx:49` — append to the base class string:

```
origin-(--radix-tooltip-content-transform-origin)
```

The full first class string becomes:

```
"z-50 overflow-hidden rounded-sm border border-border bg-popover px-3 py-1.5 font-medium text-popover-foreground text-xs origin-(--radix-tooltip-content-transform-origin"
```

- [ ] **Step 4: Shorten the delay**

`app-tooltip.tsx:25` — change `delay = 400` to `delay = 300`. Radix's `skipDelayDuration` (default 300 ms) still makes the *next* tooltip instant, which is the behaviour the skill asks for.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/ui/core/tooltip.motion.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Verify manually**

Hover the copy button in a code block. In DevTools → Animations at 10% speed, confirm the tooltip grows from the side nearest the button for `side="top"`, `"bottom"`, `"left"` and `"right"`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/shared/ui/core/tooltip.tsx apps/web/src/shared/ui/kit/app-tooltip.tsx apps/web/src/shared/ui/core/tooltip.motion.test.ts
git commit -m "fix(web): make tooltips scale from their trigger"
```

---

### Task 6: Button press feedback

> **Status: reversed.** The `active:scale-[0.97]` press scale was implemented, then removed after a human review said it looked odd in the product. `button.motion.test.ts` now asserts its absence. Do not re-add the scale.

Closes F13.

**Files:**
- Modify: `apps/web/src/shared/ui/core/button.tsx:8`
- Test: `apps/web/src/shared/ui/core/button.motion.test.ts` (**create**)

**Interfaces:**
- Produces: every `AppButton` scales to 0.97 on press over 120 ms, disabling itself under reduced motion. All consumers inherit this — no consumer edits needed.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/shared/ui/core/button.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const button = readFileSync(join(process.cwd(), "src/shared/ui/core/button.tsx"), "utf8");

describe("button feedback", () => {
  it("scales down on press", () => {
    expect(button).toContain("active:scale-[0.97]");
  });

  it("drops the press scale under reduced motion", () => {
    expect(button).toContain("motion-reduce:active:scale-100");
  });

  it("a press never animates longer than 160ms", () => {
    expect(button).toContain("transition-standard");
    expect(button).not.toMatch(/active:.*duration-(3|4|5)\d\d/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/ui/core/button.motion.test.ts`
Expected: FAIL — `active:scale-[0.97]` missing.

- [ ] **Step 3: Add the press state**

`button.tsx:8` — insert after `transition-standard`:

```
active:scale-[0.97] motion-reduce:active:scale-100
```

Full base string:

```
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium text-sm transition-standard active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0"
```

Do not add this to the `link` variant — a text link must not shrink. If it bothers you in review, add `active:scale-100` to the `link` variant only.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/ui/core/button.motion.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Verify manually**

Press and hold a primary button. It should shrink on `pointerdown` and return on release, and the whole motion should read as instant. With Reduce motion on, there should be no scale at all.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/shared/ui/core/button.tsx apps/web/src/shared/ui/core/button.motion.test.ts
git commit -m "feat(web): add press feedback to the shared button"
```

---

### Task 7: Copy button icon swap without `scale(0)`

Closes F14.

**Files:**
- Modify: `apps/web/src/shared/ui/kit/copy-button.tsx:63-75`
- Test: `apps/web/src/shared/ui/kit/copy-button.motion.test.ts` (**create**)

**Interfaces:**
- Consumes: nothing.
- Produces: a `scale(0.9)` + opacity swap between the copy and check icons.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/shared/ui/kit/copy-button.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const button = readFileSync(join(process.cwd(), "src/shared/ui/kit/copy-button.tsx"), "utf8");

describe("copy button swap", () => {
  it("never collapses an icon to zero", () => {
    expect(button).not.toMatch(/\bscale-0\b/);
  });

  it("enters from a visible scale", () => {
    expect(button).toContain("scale-90");
  });

  it("stays inside the 300ms budget", () => {
    expect(button).not.toMatch(/duration-(3|4|5|6|7|8|9)\d\d/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/ui/kit/copy-button.motion.test.ts`
Expected: FAIL — `scale-0` present.

- [ ] **Step 3: Replace the scale values**

In `copy-button.tsx`, replace both `scale-0` occurrences with `scale-90`:

```tsx
        <Copy
          className={cn(
            "absolute size-3.5 transition-standard duration-200",
            isCopied ? "scale-90 opacity-0" : "scale-100 opacity-100",
          )}
        />

        <Check
          className={cn(
            "absolute size-3.5 text-success transition-standard duration-200",
            isCopied ? "scale-100 opacity-100" : "scale-90 opacity-0",
          )}
        />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/ui/kit/copy-button.motion.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Verify manually**

Click copy in a code block. The icons should cross-fade with a slight shrink, not pop in from a dot.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/shared/ui/kit/copy-button.tsx apps/web/src/shared/ui/kit/copy-button.motion.test.ts
git commit -m "fix(web): swap copy icons without scaling from zero"
```

---

### Task 8: Kill `transition-all` in the OTP input

Closes F15.

**Files:**
- Modify: `apps/web/src/shared/ui/core/input-otp.tsx:53`
- Test: `apps/web/src/shared/ui/core/input-otp.motion.test.ts` (**create**)

**Interfaces:**
- Produces: the OTP slot only transitions border colour and ring.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/shared/ui/core/input-otp.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const otp = readFileSync(join(process.cwd(), "src/shared/ui/core/input-otp.tsx"), "utf8");

describe("otp input motion", () => {
  it("never uses transition-all", () => {
    expect(otp).not.toContain("transition-all");
  });

  it("names the properties it animates", () => {
    expect(otp).toContain("transition-[border-color,box-shadow]");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/ui/core/input-otp.motion.test.ts`
Expected: FAIL — `transition-all` present.

- [ ] **Step 3: Name the properties**

`input-otp.tsx:53` — replace `transition-all` with `transition-[border-color,box-shadow] duration-150 ease-out`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/ui/core/input-otp.motion.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/shared/ui/core/input-otp.tsx apps/web/src/shared/ui/core/input-otp.motion.test.ts
git commit -m "fix(web): name the transitioned properties in the otp input"
```

---

### Task 9: Command palette opens instantly

> **Status: reversed.** The palette now keeps the standard dialog animation, so `DialogContent` has no `animated` prop and `command.motion.test.ts` was removed. Do not re-add the opt-out.

Closes F17.

**Files:**
- Modify: `apps/web/src/shared/ui/core/dialog.tsx:59-76`
- Modify: `apps/web/src/shared/ui/core/command.tsx:42`
- Test: `apps/web/src/shared/ui/core/command.motion.test.ts` (**create**)

**Interfaces:**
- Consumes: the `DialogContent` from Task 4.
- Produces: `DialogContent` accepts `animated?: boolean` (default `true`). `CommandDialog` passes `animated={false}`. Every other dialog keeps the 300/200 ms behaviour.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/shared/ui/core/command.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("command palette motion", () => {
  it("exposes an animated escape hatch on DialogContent", () => {
    expect(read("src/shared/ui/core/dialog.tsx")).toContain("animated = true");
    expect(read("src/shared/ui/core/dialog.tsx")).toContain("animated?: boolean");
  });

  it("opens the palette with no animation at all", () => {
    expect(read("src/shared/ui/core/command.tsx")).toContain("animated={false}");
  });

  it("keeps the normal dialog animated", () => {
    expect(read("src/shared/ui/core/dialog.tsx")).toContain("data-[state=open]:duration-300");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/ui/core/command.motion.test.ts`
Expected: FAIL — `animated = true` and `animated={false}` missing.

- [ ] **Step 3: Add the prop to `DialogContent`**

`dialog.tsx:59-76` — replace the component signature and className with:

```tsx
function DialogContent({
  children,
  className,
  showCloseButton = true,
  animated = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  animated?: boolean;
}) {
  const t = useTranslations("Common");

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border bg-popover p-6 text-popover-foreground outline-hidden sm:max-w-lg",
          animated &&
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=open]:ease-out-expo data-[state=closed]:animate-out data-[state=open]:animate-in",
          className,
        )}
        data-slot="dialog-content"
        {...props}
      >
```

Leave the rest of the component unchanged.

- [ ] **Step 4: Turn the animation off for the palette**

`command.tsx:42` — change:

```tsx
      <DialogContent className="overflow-hidden p-0">
```

to:

```tsx
      <DialogContent
        animated={false}
        className="overflow-hidden p-0"
      >
```

The overlay still fades in, so the screen dims rather than flashing; the panel itself appears in one frame.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/ui/core/command.motion.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Verify manually**

Press `Ctrl+K` ten times in a row. There should be zero perceptible delay between the keystroke and the palette. Then open the API-key rotate dialog and confirm it still animates.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/shared/ui/core/dialog.tsx apps/web/src/shared/ui/core/command.tsx apps/web/src/shared/ui/core/command.motion.test.ts
git commit -m "fix(web): open the command palette without modal animation"
```

---

### Task 10: Sidebar offcanvas on the compositor

Closes F16.

**Files:**
- Modify: `apps/web/src/shared/ui/core/sidebar.tsx:350-354`
- Test: `apps/web/src/shared/ui/core/sidebar.motion.test.ts` (**create**)

**Interfaces:**
- Produces: the sidebar slides out with `translate`, not by animating `left`/`right`. The width transition stays (there is no transform equivalent for the layout spacer).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/shared/ui/core/sidebar.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sidebar = readFileSync(join(process.cwd(), "src/shared/ui/core/sidebar.tsx"), "utf8");

describe("sidebar motion", () => {
  it("does not animate left and right", () => {
    expect(sidebar).not.toContain("transition-[left,right,width]");
  });

  it("slides the offcanvas state with translate", () => {
    expect(sidebar).toContain("transition-[width,translate]");
    expect(sidebar).toContain("group-data-[collapsible=offcanvas]:-translate-x-full");
    expect(sidebar).toContain("group-data-[collapsible=offcanvas]:translate-x-full");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/ui/core/sidebar.motion.test.ts`
Expected: FAIL — old property list present.

- [ ] **Step 3: Swap the properties**

`sidebar.tsx:350` — replace `transition-[left,right,width]` with `transition-[width,translate]`.

`sidebar.tsx:353-354` — replace:

```tsx
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:-left-(--sidebar-width)"
            : "right-0 group-data-[collapsible=offcanvas]:-right-(--sidebar-width)",
```

with:

```tsx
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:-translate-x-full"
            : "right-0 group-data-[collapsible=offcanvas]:translate-x-full",
```

Leave `sidebar.tsx:337` (the width spacer) untouched — it exists to reserve layout space and has no transform equivalent. Do not change `transition-[margin,opacity]` on line 520; it is a 200 ms menu-button state, already inside budget.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/ui/core/sidebar.motion.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify manually**

Collapse the sidebar with `Ctrl+B`. It should slide smoothly with no jank on the content beside it, and dragging the resize handle must still have transitions disabled (`data-resizing`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/shared/ui/core/sidebar.tsx apps/web/src/shared/ui/core/sidebar.motion.test.ts
git commit -m "fix(web): slide the sidebar with translate instead of layout offsets"
```

---

### Task 11: Circular progress gauge timing

Closes F19.

**Files:**
- Modify: `apps/web/src/shared/ui/core/animated-circular-progress-bar.tsx:40,62-99`
- Test: `apps/web/src/shared/ui/core/animated-circular-progress-bar.motion.test.ts` (**create**)

**Interfaces:**
- Produces: the gauge animates only `stroke-dasharray` over 400 ms on the shared curve. `stroke-dasharray` is paint-only; there is no compositor equivalent for an arc length, so this is a documented exception, like accordion height.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/shared/ui/core/animated-circular-progress-bar.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const file = readFileSync(
  join(process.cwd(), "src/shared/ui/core/animated-circular-progress-bar.tsx"),
  "utf8",
);

describe("circular gauge motion", () => {
  it("never transitions every property", () => {
    expect(file).not.toContain('transition: "all');
    expect(file).not.toContain("transition: `all");
  });

  it("animates only the arc length", () => {
    expect(file).toContain("transitionProperty: \"stroke-dasharray\"");
  });

  it("settles inside half a second", () => {
    expect(file).toContain('"--transition-length": "400ms"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/ui/core/animated-circular-progress-bar.motion.test.ts`
Expected: FAIL — `transition: "all` present and `--transition-length` is `1s`.

- [ ] **Step 3: Shorten the run**

`animated-circular-progress-bar.tsx:40` — change `"--transition-length": "1s"` to `"--transition-length": "400ms"`.

- [ ] **Step 4: Replace both circle transitions**

Secondary circle (around line 72) — replace:

```ts
                transition: "all var(--transition-length) ease var(--delay)",
```

with:

```ts
                transition: "stroke-dasharray var(--transition-length) var(--ease-out) var(--delay)",
```

Primary circle (around lines 95-97) — replace:

```ts
              transition:
                "var(--transition-length) ease var(--delay),stroke var(--transition-length) ease var(--delay)",
              transitionProperty: "stroke-dasharray,transform",
```

with:

```ts
              transitionDelay: "var(--delay)",
              transitionDuration: "var(--transition-length)",
              transitionProperty: "stroke-dasharray",
              transitionTimingFunction: "var(--ease-out)",
```

Biome sorts these keys alphabetically — verify after formatting.

There is already a `var(--ease-out)` fallback problem if the token is not emitted; `--ease-out` is declared in `@theme` by Task 2 and is referenced by the utility, so it is emitted. If the gauge ever renders with a Laravel-style snap, add `, cubic-bezier(0.23, 1, 0.32, 1)` inside each `var()`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/ui/core/animated-circular-progress-bar.motion.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Verify manually**

Open a repo card with a score gauge and watch it settle. It should fill in under half a second with a fast start, and should not sweep for a full second.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/shared/ui/core/animated-circular-progress-bar.tsx apps/web/src/shared/ui/core/animated-circular-progress-bar.motion.test.ts
git commit -m "fix(web): settle the score gauge in 400ms without transitioning everything"
```

---

### Task 12: Agent panel — one driver, compositor only, reduced motion

Closes F24, F25, F26.

**Files:**
- Modify: `apps/web/src/features/agent/ui/agent.tsx:311-346`
- Test: `apps/web/src/features/agent/ui/agent.motion.test.ts` (**create**)

**Interfaces:**
- Consumes: `EASING` from Task 1.
- Produces: the panel fades and slides 8 px; its inset geometry snaps instead of tweening; `useReducedMotion()` removes the slide.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/features/agent/ui/agent.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const agent = readFileSync(join(process.cwd(), "src/features/agent/ui/agent.tsx"), "utf8");

describe("agent panel motion", () => {
  it("never tweens layout offsets", () => {
    expect(agent).not.toMatch(/animate=\{\{\s*bottom:/);
    expect(agent).not.toMatch(/initial=\{\{\s*bottom:/);
  });

  it("snaps the geometry through style instead", () => {
    expect(agent).toContain("style={insets}");
  });

  it("drops the slide under reduced motion", () => {
    expect(agent).toContain("useReducedMotion");
    expect(agent).toContain("reduceMotion ? 0 : 8");
  });

  it("does not run a 450ms tween", () => {
    expect(agent).not.toMatch(/duration: 0\.45/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/features/agent/ui/agent.motion.test.ts`
Expected: FAIL — `animate={{ bottom:` present, `style={insets}` missing.

- [ ] **Step 3: Add the imports**

At the top of `agent.tsx`, extend the motion import:

```tsx
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
```

Add, alongside the other `@/shared` imports:

```tsx
import { EASING } from "@/shared/config/motion";
```

- [ ] **Step 4: Replace the animation block**

Replace `agent.tsx:311-346` (from `const wrapperClasses = cn(` through the opening `<motion.div ...>` tag) with:

```tsx
  const reduceMotion = useReducedMotion();

  const wrapperClasses = cn(
    "fixed z-50 flex overflow-hidden",
    // The panel is position:fixed and out of flow, so this reflows its own subtree only.
    "transition-[left] duration-300 ease-out-expo",
    "group-data-[resizing]/sidebar-wrapper:transition-none",
    expanded ? (open ? openLeft : collapsedLeft) : "left-[calc(100vw-450px)]",
  );

  const insets = expanded
    ? { bottom: 16, right: 16, top: isRepoOwnerPage ? 126 : 86 }
    : { bottom: 20, right: 20, top: "calc(100vh - 740px)" };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className={wrapperClasses}
          exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          style={insets}
          transition={{ duration: 0.2, ease: [...EASING.out] }}
        >
```

Everything after the opening tag (the `<aside>` and its children) stays exactly as it is.

The panel is now driven by one system. `left` still transitions so the panel keeps up with the sidebar, but it only animates while the sidebar collapses — a fixed-position element reflowing its own subtree, not the page. The expand/collapse geometry snaps; the perceived motion comes from the 8 px fade-slide.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/features/agent/ui/agent.motion.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verify manually**

1. Open and close the agent panel — a 200 ms fade with a small lift, no sweeping rectangle.
2. Expand it to full size — the box should resize in one frame and the content should not appear to fly.
3. Collapse and expand the sidebar — the panel should keep pace.
4. With Reduce motion on, reopening the panel must not slide.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/agent/ui/agent.tsx apps/web/src/features/agent/ui/agent.motion.test.ts
git commit -m "fix(web): animate the agent panel with transform only"
```

---

### Task 13: Public header respects reduced motion

Closes F33.

**Files:**
- Modify: `apps/web/src/widgets/public-header/ui/public-header-wrapper.tsx:4,39-60`
- Test: `apps/web/src/widgets/public-header/ui/public-header-wrapper.motion.test.ts` (**create**)

**Interfaces:**
- Produces: the header fades instead of sliding when motion is reduced.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/widgets/public-header/ui/public-header-wrapper.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const header = readFileSync(
  join(process.cwd(), "src/widgets/public-header/ui/public-header-wrapper.tsx"),
  "utf8",
);

describe("public header motion", () => {
  it("reads the reduced-motion preference", () => {
    expect(header).toContain("useReducedMotion");
  });

  it("does not translate when motion is reduced", () => {
    expect(header).toContain('y: reduceMotion ? 0 : "-100%"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/widgets/public-header/ui/public-header-wrapper.motion.test.ts`
Expected: FAIL — `useReducedMotion` missing.

- [ ] **Step 3: Add the guard**

`public-header-wrapper.tsx:4` — change the import to:

```tsx
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
```

Inside the component, after `const [isHidden, setIsHidden] = useState(false);`, add:

```tsx
  const reduceMotion = useReducedMotion();
```

In the `variants` object, replace the `hidden` entry:

```tsx
          hidden: {
            opacity: 0,
            pointerEvents: "none",
            y: reduceMotion ? 0 : "-100%",
          },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/widgets/public-header/ui/public-header-wrapper.motion.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify manually**

Scroll down on the landing page with Reduce motion enabled. The header should disappear by fading, not by sliding off the top.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/widgets/public-header/ui/public-header-wrapper.tsx apps/web/src/widgets/public-header/ui/public-header-wrapper.motion.test.ts
git commit -m "fix(web): fade the public header when motion is reduced"
```

---

### Task 14: Landing motion — scales, loops, and the broken marquee direction

Closes F35, F36, F07 (landing half).

**Files:**
- Modify: `apps/web/src/shared/ui/visuals/text-animate.variants.ts:41-44,160-205`
- Modify: `apps/web/src/shared/ui/visuals/text-animate.tsx:44,118-129`
- Modify: `apps/web/src/shared/ui/visuals/animated-beam.tsx:4,134-143`
- Modify: `apps/web/src/shared/ui/visuals/background-beams-with-collision.tsx:190-210`
- Modify: `apps/web/src/shared/ui/visuals/marquee.tsx:42`
- Test: `apps/web/src/shared/ui/visuals/text-animate.variants.test.ts` (append) and `apps/web/src/shared/ui/visuals/marquee.motion.test.ts` (**create**)

**Interfaces:**
- Consumes: `EASING` from Task 1.
- Produces: `EXIT_EASING` equals `EASING.out`; entrance scales stay inside 0.9–1.1; `Marquee`'s `reverse` prop works.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/shared/ui/visuals/text-animate.variants.test.ts`:

```ts
import { EASING } from "@/shared/config/motion";

describe("tasteful entrances", () => {
  it("never enters from a half-size element", () => {
    const scaleUp = defaultItemAnimationVariants.scaleUp.item.hidden as { scale?: number };
    const scaleDown = defaultItemAnimationVariants.scaleDown.item.hidden as { scale?: number };
    expect(scaleUp.scale).toBeGreaterThanOrEqual(0.9);
    expect(scaleDown.scale).toBeLessThanOrEqual(1.1);
  });

  it("exits on the same curve it enters with", () => {
    expect([...EXIT_EASING]).toEqual([...EASING.out]);
  });

  it("keeps every entrance duration under a second", () => {
    for (const { item } of Object.values(defaultItemAnimationVariants)) {
      const show = item.show as { transition?: { duration?: number } };
      expect(show.transition?.duration ?? 0).toBeLessThanOrEqual(0.5);
    }
  });
});
```

```ts
// apps/web/src/shared/ui/visuals/marquee.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const marquee = readFileSync(join(process.cwd(), "src/shared/ui/visuals/marquee.tsx"), "utf8");

describe("marquee", () => {
  it("reverses with animation-direction, not the invalid direction property", () => {
    expect(marquee).not.toContain("direction-[reverse]");
    expect(marquee).toContain("[animation-direction:reverse]");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun --filter @doxynix/web test src/shared/ui/visuals/text-animate.variants.test.ts src/shared/ui/visuals/marquee.motion.test.ts`
Expected: FAIL — `scaleUp` enters from `0.5`, `EXIT_EASING` differs from `EASING.out`, `direction-[reverse]` present.

- [ ] **Step 3: Fix the exit curve**

`text-animate.variants.ts:41-44` — replace the two easing lines:

```ts
export const ENTER_EASING = [...EASING.expoOut] as const;
export const EXIT_EASING = [...EASING.out] as const;
```

and add the import at the top of the file:

```ts
import { EASING } from "@/shared/config/motion";
```

- [ ] **Step 4: Fix the entrance scales**

`text-animate.variants.ts:168` — change `scale: 1.5` in `scaleDown.hidden` to `scale: 1.08`.

`text-animate.variants.ts:191` — change `scale: 0.5` in `scaleUp.hidden` to `scale: 0.92`.

Leave the exit scales (`scaleDown.exit.scale: 1.5`, `scaleUp.exit.scale: 0.5`) alone — exits may collapse; entrances may not.

- [ ] **Step 5: Turn the loop off under reduced motion**

`text-animate.tsx` — import and use the hook:

```tsx
import { AnimatePresence, type MotionProps, motion, useReducedMotion, type Variants } from "motion/react";
```

Add inside the component, before `let segments`:

```tsx
  const reduceMotion = useReducedMotion();
```

Change the container's props:

```tsx
        animate={startOnView || reduceMotion ? undefined : "show"}
        initial={reduceMotion ? false : "hidden"}
        whileInView={startOnView && !reduceMotion ? "show" : undefined}
```

`animated-beam.tsx:4` — change the import to `import { motion, useReducedMotion } from "motion/react";`, add `const reduceMotion = useReducedMotion();` inside the component, and change the gradient's `animate` condition at line 135 from `isActive` to `isActive && !reduceMotion`.

`background-beams-with-collision.tsx` — add `useReducedMotion` to the existing `motion/react` import, add `const reduceMotion = useReducedMotion();` inside `CollisionMechanism`, change `animate="animate"` on the beam `motion.div` to:

```tsx
        animate={reduceMotion ? undefined : "animate"}
```

and add `if (reduceMotion) return;` as the first line of the collision `useEffect`, adding `reduceMotion` to that effect's dependency array.

- [ ] **Step 6: Fix the marquee direction**

`marquee.tsx:42` — change:

```tsx
              "direction-[reverse]": reverse,
```

to:

```tsx
              "[animation-direction:reverse]": reverse,
```

`direction` only accepts `ltr`/`rtl`, so the old class produced no CSS and `reverse` silently did nothing.

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun --filter @doxynix/web test src/shared/ui/visuals/`
Expected: PASS, including the pre-existing tests in that directory.

- [ ] **Step 8: Verify manually**

Open the landing page with Reduce motion off: the hero title should stagger in from 92% scale, not appear from half size. Turn Reduce motion on: the title, the beams and the marquee should be static, and the header should still show. Enable `reverse` on a marquee instance and confirm it scrolls the other way.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/shared/ui/visuals/
git commit -m "fix(web): tighten landing entrances and honour reduced motion"
```

---

### Task 15: Repo map hover timing

Closes F28, F29.

**Files:**
- Modify: `apps/web/src/features/repo-map/model/use-map-layout.ts:76`
- Modify: `apps/web/src/features/repo-map/model/repo-map-hover.ts:27`
- Modify: `apps/web/src/features/repo-map/ui/repo-node.tsx:124`
- Modify: `apps/web/src/features/repo-map/ui/repo-map.tsx:237`
- Test: `apps/web/src/features/repo-map/model/repo-map.motion.test.ts` (**create**)

**Interfaces:**
- Produces: hover dimming on the graph settles in 120 ms instead of 300 ms, on the shared curve.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/features/repo-map/model/repo-map.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const curve = "cubic-bezier(0.23, 1, 0.32, 1)";

describe("repo map hover", () => {
  it("dims edges in 120ms on the shared curve", () => {
    expect(read("src/features/repo-map/model/use-map-layout.ts")).toContain(
      `transition: "opacity 120ms ${curve}"`,
    );
    expect(read("src/features/repo-map/model/repo-map-hover.ts")).toContain(
      `transition: "opacity 120ms ${curve}"`,
    );
  });

  it("dims nodes fast enough for a hover", () => {
    const node = read("src/features/repo-map/ui/repo-node.tsx");
    expect(node).toContain("transition-opacity duration-150");
    expect(node).not.toContain("duration-300 ease-in-out");
  });

  it("drops the dead opacity transition", () => {
    expect(read("src/features/repo-map/ui/repo-map.tsx")).not.toContain(
      'className={cn("transition-opacity duration-300")}',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/features/repo-map/model/repo-map.motion.test.ts`
Expected: FAIL — all three groups.

- [ ] **Step 3: Retime the edges**

`use-map-layout.ts:76` and `repo-map-hover.ts:27` — replace both occurrences of:

```ts
        transition: "opacity 0.3s ease-in-out",
```

with:

```ts
        transition: "opacity 120ms cubic-bezier(0.23, 1, 0.32, 1)",
```

The literal is deliberate: these strings are passed into SVG styles through React Flow, where a CSS custom property is resolved on an element we do not control.

- [ ] **Step 4: Retime the nodes**

`repo-node.tsx:124` — change `transition-opacity duration-300 ease-in-out` to `transition-opacity duration-150 ease-out`.

- [ ] **Step 5: Delete the dead class**

`repo-map.tsx:237` — change:

```tsx
                <div className={cn("transition-opacity duration-300")}>
```

to:

```tsx
                <div>
```

The wrapper's opacity never changes, so the transition never fires.

- [ ] **Step 6: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/features/repo-map/model/repo-map.motion.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Verify manually**

Open a repo map and sweep the cursor across nodes. Non-connected nodes should dim almost immediately; the old 300 ms felt like lag.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/repo-map/
git commit -m "fix(web): tighten repo map hover timing"
```

---

### Task 16: Charts stop drawing themselves on mount

Closes F27.

**Files:**
- Modify: `apps/web/src/features/repo-analytics/ui/repo-trends-chart.tsx:160,169,179,188,197`
- Modify: `apps/web/src/features/manage-subscription/ui/usage-forecast-chart.tsx:228,237`
- Modify: `apps/web/src/entities/repo/ui/repo-quality-radar.tsx:53`
- Modify: `apps/web/src/entities/repo/ui/repo-complexity-scatter-chart.tsx:133`
- Test: `apps/web/src/features/repo-analytics/ui/charts.motion.test.ts` (**create**)

**Interfaces:**
- Produces: every data-series primitive in the dashboard renders its final geometry immediately. `apps/web/src/widgets/landing/ui/analytics-chart.tsx` stays animated — that is a marketing surface.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/features/repo-analytics/ui/charts.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const files = [
  "src/features/repo-analytics/ui/repo-trends-chart.tsx",
  "src/features/manage-subscription/ui/usage-forecast-chart.tsx",
  "src/entities/repo/ui/repo-quality-radar.tsx",
  "src/entities/repo/ui/repo-complexity-scatter-chart.tsx",
];

describe("dashboard charts", () => {
  for (const file of files) {
    it(`renders ${file} without a mount animation`, () => {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const series = source.match(/<(Area|Radar|Scatter)\b/g) ?? [];
      const disabled = source.match(/isAnimationActive=\{false\}/g) ?? [];
      expect(series.length).toBeGreaterThan(0);
      expect(disabled.length).toBe(series.length);
    });
  }

  it("leaves the marketing chart animated", () => {
    const landing = readFileSync(
      join(process.cwd(), "src/widgets/landing/ui/analytics-chart.tsx"),
      "utf8",
    );
    expect(landing).not.toContain("isAnimationActive={false}");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/features/repo-analytics/ui/charts.motion.test.ts`
Expected: FAIL — 4 files, zero `isAnimationActive` props.

- [ ] **Step 3: Disable the mount animation**

Add `isAnimationActive={false}` as the **first prop** of every `<Area`, `<Radar` and `<Scatter` element in the four files. Each edit is the same two-line insertion — do not reorder or rewrite the existing props, Biome will sort them afterwards:

```diff
           <Area
+            isAnimationActive={false}
             dataKey="docs"
```

There are five `<Area>` elements in `repo-trends-chart.tsx`, two in `usage-forecast-chart.tsx`, one `<Radar>` and one `<Scatter>` — nine insertions total.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/features/repo-analytics/ui/charts.motion.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Verify manually**

Open repo analytics and the subscription usage page. Charts should appear complete on first paint. Reload three times and confirm there is no 1.5 s draw. Then open the landing page and confirm its chart still animates.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/repo-analytics/ui/repo-trends-chart.tsx apps/web/src/features/manage-subscription/ui/usage-forecast-chart.tsx apps/web/src/entities/repo/ui/repo-quality-radar.tsx apps/web/src/entities/repo/ui/repo-complexity-scatter-chart.tsx apps/web/src/features/repo-analytics/ui/charts.motion.test.ts
git commit -m "fix(web): render dashboard charts without a mount animation"
```

---

### Task 17: Dashboard micro-motion and idle pulses

Closes F30, F31, F22.

**Files:**
- Modify: `apps/web/src/features/repo-docs-viewer/ui/repo-docs-content.tsx:405`
- Modify: `apps/web/src/entities/repo/ui/repo-status-bar.tsx:33`
- Modify: `apps/web/src/entities/repo/ui/repo-analytics-cards.tsx:222`
- Modify: `apps/web/src/shared/ui/core/mermaid.tsx:177`
- Test: `apps/web/src/features/repo-docs-viewer/ui/repo-docs-content.motion.test.ts` (**create**)

**Interfaces:**
- Produces: no UI entrance over 300 ms and no idle pulse on a static status signal.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/features/repo-docs-viewer/ui/repo-docs-content.motion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("dashboard micro-motion", () => {
  it("swaps doc content inside the budget", () => {
    const docs = read("src/features/repo-docs-viewer/ui/repo-docs-content.tsx");
    expect(docs).toContain("animate-in duration-200");
    expect(docs).not.toContain("duration-500");
  });

  it("does not pulse a static status icon", () => {
    expect(read("src/entities/repo/ui/repo-status-bar.tsx")).not.toContain("animate-pulse");
    expect(read("src/entities/repo/ui/repo-analytics-cards.tsx")).not.toContain("animate-pulse");
  });

  it("fades a mounted diagram inside the budget", () => {
    const mermaid = read("src/shared/ui/core/mermaid.tsx");
    expect(mermaid).toContain("duration-200");
    expect(mermaid).not.toContain("duration-300");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/features/repo-docs-viewer/ui/repo-docs-content.motion.test.ts`
Expected: FAIL — `duration-500`, two `animate-pulse`, and the mermaid `duration-300`.

- [ ] **Step 3: Retime the docs swap**

`repo-docs-content.tsx:405` — change `fade-in slide-in-from-bottom-2 animate-in duration-500` to `fade-in slide-in-from-bottom-2 animate-in duration-200`.

- [ ] **Step 4: Remove the idle pulses**

`repo-status-bar.tsx:33` — change `"flex animate-pulse items-center gap-1 text-warning"` to `"flex items-center gap-1 text-warning"`.

`repo-analytics-cards.tsx:222` — change `<ShieldAlert className="size-5 animate-pulse text-destructive" />` to `<ShieldAlert className="size-5 text-destructive" />`.

Both icons keep their warning colour; they simply stop breathing. A signal the user reads should not pulse.

- [ ] **Step 5: Retime the diagram fade**

`mermaid.tsx:177` — change the trailing `duration-300` to `duration-200` in that class list.

- [ ] **Step 6: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/features/repo-docs-viewer/ui/repo-docs-content.motion.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/repo-docs-viewer/ui/repo-docs-content.tsx apps/web/src/entities/repo/ui/repo-status-bar.tsx apps/web/src/entities/repo/ui/repo-analytics-cards.tsx apps/web/src/shared/ui/core/mermaid.tsx apps/web/src/features/repo-docs-viewer/ui/repo-docs-content.motion.test.ts
git commit -m "fix(web): remove idle pulses and overlong dashboard transitions"
```

---

### Task 18: Consolidate the last two curves

Closes F40, F41, and the guard half of F03.

**Files:**
- Modify: `apps/web/src/shared/lib/appearance-preferences.ts:242`
- Modify: `apps/web/src/entities/repo/ui/repo-swagger.tsx:88-89`
- Test: `apps/web/src/shared/config/motion-consumers.test.ts` (**create**)

**Interfaces:**
- Consumes: `EASING` from Task 1.
- Produces: no hand-rolled cubic-bezier outside `motion.ts` and `globals.css`. The guard fails if one reappears.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/shared/config/motion-consumers.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const LEGACY_CURVES = [
  "cubic-bezier(0.4, 0, 0.2, 1)",
  "cubic-bezier(0.25, 0.8, 0.25, 1)",
  "cubic-bezier(0.4, 0, 1, 1)",
];

const files = walk(SRC)
  .filter((file) => /\.(tsx?|css)$/.test(file))
  .filter((file) => !file.includes(".test."))
  .map((file) => relative(process.cwd(), file));

describe("curve consolidation", () => {
  for (const curve of LEGACY_CURVES) {
    it(`does not hardcode ${curve}`, () => {
      const offenders = files.filter((file) =>
        readFileSync(join(process.cwd(), file), "utf8").includes(curve),
      );
      expect(offenders).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @doxynix/web test src/shared/config/motion-consumers.test.ts`
Expected: FAIL — `0.4, 0, 0.2, 1` in `repo-swagger.tsx`, `0.25, 0.8, 0.25, 1` in `appearance-preferences.ts`.

- [ ] **Step 3: Route the theme view-transition through the contract**

`appearance-preferences.ts:242` — replace:

```ts
              easing: "cubic-bezier(0.25, 0.8, 0.25, 1)",
```

with:

```ts
              easing: `cubic-bezier(${EASING.out.join(", ")})`,
```

and add to the imports at the top of the file:

```ts
import { EASING } from "@/shared/config/motion";
```

`shared/lib` importing `shared/config` is a downward import inside the same layer and is allowed by `arch:check`.

- [ ] **Step 4: Fix the Scalar docs theme**

`repo-swagger.tsx:89` — replace:

```css
          --scalar-transition-curve: cubic-bezier(0.4, 0, 0.2, 1) !important;
```

with:

```css
          --scalar-transition-curve: cubic-bezier(0.23, 1, 0.32, 1) !important;
```

This value is injected into a third-party component's shadow-free DOM, so it is a literal rather than a `var()`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --filter @doxynix/web test src/shared/config/motion-consumers.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/shared/lib/appearance-preferences.ts apps/web/src/entities/repo/ui/repo-swagger.tsx apps/web/src/shared/config/motion-consumers.test.ts
git commit -m "fix(web): route remaining transitions through the shared curve"
```

---

### Task 19: Class-contract guard and full validation

Closes F50.

**Files:**
- Create: `apps/web/src/shared/ui/motion-policy.test.ts`

**Interfaces:**
- Consumes: every previous task. This test must be written **last**; it fails until all fixes land.

- [ ] **Step 1: Write the guard**

```ts
// apps/web/src/shared/ui/motion-policy.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src/shared/ui");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = walk(ROOT)
  .filter((file) => file.endsWith(".tsx") || file.endsWith(".ts"))
  .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"));

const RULES = [
  { name: "transition-all", pattern: /\btransition-all\b/ },
  { name: "ease-in", pattern: /\bease-in\b(?!-out)/ },
  { name: "scale(0) entrance", pattern: /\bscale-0\b/ },
  { name: "UI duration over 300ms", pattern: /duration-[4-9]\d\d\b/ },
  { name: "transition: all", pattern: /transition:\s*["'`]all\b/ },
];

// Each entry is a deliberate, reviewed exception. Keep the reason on the same line.
const ALLOWED = new Map<string, string>([
  [
    "core/animated-circular-progress-bar.tsx",
    "arc length has no compositor equivalent; paint-only by design",
  ],
]);

function offenders(pattern: RegExp): string[] {
  return sources
    .map((file) => relative(ROOT, file))
    .filter((file) => !ALLOWED.has(file))
    .filter((file) => pattern.test(readFileSync(join(ROOT, file), "utf8")));
}

describe("motion policy", () => {
  for (const rule of RULES) {
    it(`has no ${rule.name} in shared/ui`, () => {
      expect(offenders(rule.pattern)).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run the guard**

Run: `bun --filter @doxynix/web test src/shared/ui/motion-policy.test.ts`
Expected: PASS, 5 tests. If a rule fails, fix the named file — do **not** add it to `ALLOWED` unless it is genuinely exempt, and then write the reason.

- [ ] **Step 3: Run every motion test together**

Run: `bun --filter @doxynix/web test src/shared/config/motion.test.ts src/shared/ui src/features/agent src/features/repo-map src/features/repo-analytics src/features/repo-docs-viewer src/widgets/public-header`
Expected: PASS, no failures.

- [ ] **Step 4: Format and lint**

Run: `bun run format`
Then re-read every file you touched this session — Biome reorders props and object keys and may have rewritten something you are asserting on. Re-run Step 3 afterwards.

Run: `bun run lint`
Expected: no errors. Type-aware Oxlint flags `no-floating-promises`, `no-non-null-assertion`, `unicorn/filename-case` — none of the new files violate these (`motion.ts`, `motion.test.ts`, `*.motion.test.ts` are kebab-case).

- [ ] **Step 5: Run the full gate**

Run: `bun run validate`
Expected: PASS — Biome `format:check`, Oxlint with `db:generate`, `type-check`, `lint:fsd`, `lint:i18n`, `lint:locales`, `arch:check`, `dup` under 5%, `knip`.

If `knip` reports `src/shared/config/motion.ts` as unused, a task that imports it was skipped — Tasks 12, 14 and 18 do. If `dep-cruiser` reports a new violation, it will be because `shared/ui` now imports `@/shared/config/motion`: that direction is legal (`shared/config` sits below `shared/ui` in the same layer), so refresh the baseline only if the tool disagrees, with `bun --filter @doxynix/web arch:baseline`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/shared/ui/motion-policy.test.ts
git commit -m "test(web): guard the motion contract across shared ui"
```

---

## 4. Verification Checklist

Run these in order before opening the PR. Each line is a manual observation, not an automated check.

- [ ] `Ctrl+K` opens with zero delay; `Ctrl+B` slides the sidebar; the audit-log sheet closes in 200 ms with a fast start.
- [ ] A button press gives no scale change — only the colour and shadow transitions.
- [ ] Tooltips grow from the side nearest their trigger.
- [ ] Hovering a repo-map node dims the rest of the graph within ~120 ms.
- [ ] Dashboard charts are fully drawn on first paint; the landing chart still animates.
- [ ] The agent panel fades and lifts 8 px; its box no longer sweeps.
- [ ] With OS **Reduce motion** on: colour/opacity still ease over 120 ms, nothing slides, no marquee/beam/shimmer moves, spinners still spin, the command palette still opens instantly.
- [ ] Throttle the CPU to 4× in DevTools and repeat the sheet, sidebar and agent-panel checks — no visible stutter.
- [ ] At 10% animation speed, the sheet exit starts moving immediately (`ease-out`, not `ease-in`).
- [ ] Test the dashboard on a mid-range phone over USB remote debugging; the sidebar and sheet must not jank.

## 5. What is deliberately not changed

These were audited and found correct. Do not "improve" them as part of this plan.

- `dialog.tsx` modal timing (300/200, `ease-out-expo`, `zoom-in-95`, centred) — the reference implementation for the sheet.
- `popover.tsx`, `dropdown-menu.tsx`, `select.tsx` — origin-aware, `zoom-in-95`, directional slides.
- `welcome-flow.tsx`, `product-preview.tsx` — the reference implementation for reduced motion.
- `sonner.tsx` and the single `<Toaster />` at `app/[locale]/layout.tsx:170` — correct per the Sonner guidance: one root mount, theme wired, custom icons, position-derived swipe.
- `accordion.tsx` and `trace.tsx` collapsed height — the one tolerated layout animation; there is no transform equivalent.
- `resizable.tsx`, `slider.tsx` — drag surfaces with no custom animation.
- `NextTopLoader` — third-party page progress bar.
- Marquee `will-change: transform` — required by the infinite loop; four copies are intentional (they form the seamless strip).
- Marketing hover motion in `bento-grid.tsx`, `brands-section.tsx`, `support/page.tsx` — Tailwind v4 gates `hover:` behind `(hover: hover)`; these surfaces are occasional.
- Tailwind v4's `hover:` gating itself — verified by framework behaviour, not by this plan's tests.

## 6. Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-07-motion-system-audit.md`.

**1. Subagent-Driven (recommended)** — one fresh subagent per task, review between tasks, fast iteration. Task order matters: Tasks 1–2 must land before 3, and Task 19 must be last.

**2. Inline Execution** — batches of 4–5 tasks with checkpoints for review in this session.

Which approach?

