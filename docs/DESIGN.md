---
name: Doxynix
status: active
source: apps/web/src/app/globals.css
enforcement: apps/web/scripts/check-styles.ts
gallery: docs/mockups/final-cards.html
---

# Doxynix design system

The visual contract for `apps/web`. It is the reference for engineers, designers and AI agents:
every rule is either a token, a component API, a pattern, or a check. `globals.css` is the
normative source of values; this document explains intent and usage.

Utility-level reference: [`docs/TAILWIND.md`](./TAILWIND.md) — every Tailwind property, allowed
values and where it belongs in this app.

## 1. Principles

1. **One language.** The same role looks the same everywhere: card title, meta text, status,
   action, row.
2. **Semantic over raw.** Components consume roles (`bg-card`, `text-muted-foreground`,
   `text-success`), never palette steps or hex.
3. **Calm surfaces.** Flat cards, hairline borders, no decorative shadows. Color communicates
   status, not decoration.
4. **Density with air.** Dense data is welcome; cramped is not. Spacing comes from one 4px scale.
5. **Accessible by default.** Focus, contrast, keyboard, reduced motion and i18n are part of the
   definition of done, not a later pass.

## 2. Sources and layers

| Layer | Lives in | Consumed by |
| --- | --- | --- |
| Primitive | `:root` / `.dark` values in `globals.css` | semantic tokens only |
| Semantic | `@theme inline` in `globals.css` | components |
| Component | CVA variants (`Card`, `Button`, `Badge`) | app code |

Rules:

- Components use semantic tokens and component variants only.
- Raw Tailwind palette (`bg-blue-500`, `text-zinc-400`) and arbitrary colors (`bg-[#1e40af]`) are
  forbidden in app code.
- Hex is allowed only in token definitions, brand SVG icons, and provider data documented in §21.
- Do not add a component token when a semantic role exists. Keep the component layer thin.
- Tokens live in one place. Do not duplicate values in this document; it describes roles and
  intent. The checker and `globals.css` are authoritative.

## 3. Token reference

### 3.1 Typography scale

| Token | Size | Line-height | Use |
| --- | --- | --- | --- |
| `text-2xs` | 11px | 16px | micro-labels, dense meta, badges |
| `text-xs` | 12px | 16px | metadata, captions, helper text |
| `text-sm` | 14px | 20px | body, UI, rows, controls |
| `text-base` | 16px | 24px | card titles, dialog titles |
| `text-lg` | 18px | 28px | section titles |
| `text-xl` | 20px | 28px | page subheads |
| `text-2xl` | 24px | 32px | page titles |
| `text-3xl` | 30px | 36px | hero and landing |
| `text-metric` | 28px | 32px | KPI values |

Weights: 400 body, 500 controls/meta emphasis, 600 card and section titles, 700 page titles
(`h1`/`h2` in the page shell). Avoid 700 in cards and rows. Letter-spacing is zero across the scale.

### 3.2 Spacing

Base: 4px (`--spacing`).

| Step | Value | Use |
| --- | --- | --- |
| 0.5 | 2px | hairline offsets |
| 1 | 4px | inline icon gap |
| 1.5 | 6px | tight chips |
| 2 | 8px | inline gaps, control groups |
| 3 | 12px | row gaps, compact padding |
| 4 | 16px | compact card padding, grid gap |
| 6 | 24px | default card padding, section gap |
| 8 | 32px | page sections |

Do not use `p-7`, `p-13`, `gap-9` in new code. `2.5`, `3.5` and `5` exist in primitives (row
padding, chips); prefer `1/2/3/4/6/8` for new layout. One-off layout values (`w-[320px]`,
`max-h-[70vh]`, grid templates) are allowed.

### 3.3 Radius

At the default `--radius` (0.75rem / 12px):

| Token | Value | Use |
| --- | --- | --- |
| `rounded-2xs` | 2px | chart keys, tiny indicators |
| `rounded-xs` | 4px | inner indicators, flags |
| `rounded-sm` | 8.6px | rare, inner surfaces |
| `rounded-tile` | 9.6px | icon tiles |
| `rounded-md` | 10.3px | rare, nested controls |
| `rounded-lg` | 12px | small inner controls, menu items |
| `rounded-xl` | 15.6px | buttons, inputs, rows, compact cards |
| `rounded-2xl` | 19.2px | cards |
| `rounded-3xl` | 22.2px | large surfaces |
| `rounded-4xl` | 25.8px | hero/landing surfaces |
| `rounded-full` | pill | badges, avatars, pills |

Radii scale from `--radius`, which the appearance setting changes: `sharp` 4px, `default` 12px,
`soft` 24px. The whole ramp follows except `rounded-2xs`, which is a fixed 2px hairline for
chart keys and does not scale. `rounded` is an alias for `rounded-sm` (8.6px at default).

### 3.4 Breakpoints

Tailwind defaults: `sm` 40rem, `md` 48rem, `lg` 64rem, `xl` 80rem, `2xl` 96rem.
Prefer container queries inside cards and sidebars.

### 3.5 Motion

| Token | Value | Use |
| --- | --- | --- |
| `transition-standard` | 150ms `ease-out` | hover, focus, color |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | default |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | drawers/panels |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | sheets |
| enter | 200–280ms | overlays, page transitions |
| exit | 150ms (`fade-out`) | dismissals |

### 3.6 Z-index

Existing usage: `z-0` content, `z-10` sticky/raised, `z-20` dropdowns, `z-50` overlays and the
agent panel, `z-100` the skip link, `z-[9999]` only inside the agent resizable handle. New code
uses the shared overlays; do not add a new arbitrary z-index outside a library wrapper.

## 4. Typography rules

- No `text-[10px]`, `text-[13px]`, `text-[0.8rem]`. Use the nearest step.
- No `tracking-*`: letter-spacing is zero across the scale.
- Do not override `leading-*` without a reason. Line-height comes with the size token.
- `font-mono` only for code, `pre`, `code`, diff paths, terminal output and keyboard shortcuts.
- `uppercase` only for brand abbreviations (`API`, `PR`, `AI`); never for sentence labels or meta.
- Numeric columns may use `tabular-nums`; prose does not.
- One `h1` per page shell; nested settings pages use `h2` under the shell `h1` (see §6). Card
  titles are not `text-2xl` to stand out.
- Truncate with `truncate`/`line-clamp-*` and provide a `title` for the full value.
- The appearance text scale changes the root font size: compact 93.75%, default 100%, large
  106.25%. The rem-based ramp follows; do not compensate with per-component sizes.
- Body prose uses a 1.6 line-height baseline; UI text follows the size tokens.

## 5. Color and themes

### 5.1 Roles

| Role | Token | Use |
| --- | --- | --- |
| Page | `background` | app canvas |
| Surface | `card`, `popover`, `surface-hover`, `surface-selected` | cards, menus, hover/selected |
| Text | `foreground`, `muted-foreground`, `text-secondary` | primary/secondary/tertiary |
| Border | `border`, `border-strong`, `border-accent`, `input`, `ring` | hairlines, inputs, focus |
| Primary | `primary`, `primary-foreground`, `primary-accent` | primary actions, active accents |
| Status | `success`, `warning`, `destructive`, `info` (+ `-foreground`) | state only |
| Data | `chart-1`…`chart-5` | charts and legends |
| Brand | `brand-ai`, `brand-db`, `brand-ably`, `brand-trigger`, `brand-client`, `brand-docs`, `brand-tech` | integration identity |

Rules:

- Soft status background: `bg-success/10`; border `border-success/30`; text `text-success`.
- Never encode state with color alone: pair with text, icon, or shape.
- Chart colors use `--chart-*`; no per-series hex.
- Dark mode is a remap of the same roles; feature code must not contain `dark:` color pairs.
  Structural/alpha adjustments inside primitives (`dark:bg-input/30`) are allowed.
- Contrast: 4.5:1 body text, 3:1 large text and non-text controls.

### 5.2 Themes

The appearance settings expose six color themes: `neutral`, `violet`, `ocean`, `forest`, `sunset`,
`mocha`. Each theme remaps the same semantic roles. Components never reference a theme name.
Adding a theme means adding a mapping in `globals.css` and one entry in the appearance options;
no component changes.

## 6. Layout and spacing

- Page shell: sidebar + content; optional right rail. Do not invent a new page shell for a single
  screen.
- Settings shell (`app/[locale]/(private)/dashboard/settings/layout.tsx`) owns the `h1` “Settings”
  and the settings sidebar. Each settings page uses `h2 text-2xl` + description under it.
- There is no shared `PageHeader` component; the dashboard header is the page title plus the
  sticky date range. If a third page repeats the same header, extract it.
- Page horizontal padding comes from the shell; cards add their own internal padding.
- Card padding: 24px default, 16px compact. One source of padding per surface.
- Grid gaps: 16px between compact cards, 24px between sections, 32px between page blocks.
- Settings pages: title + description, then one grouped card with sections separated by hairlines.
- Lists: one container, rows separated by `border-t`, actions on hover; never a card per row.
- Forms: label above, control, helper/error below; primary action right-aligned or in the footer.
- No horizontal scroll at 360px. Long values truncate or wrap.
- Tables either scroll inside their card or become rows; the page never scrolls horizontally.

## 7. Radii and elevation

- Cards are flat: `border border-border`, no shadow.
- Popovers, dialogs, menus and the agent panel receive their shadow from the global
  `[data-slot]` rules; do not add `shadow-*` classes in feature code.
- Never add a shadow to a card to create hierarchy; use spacing, border, and type instead.
- Do not replace a radius role with `rounded-[10px]` or `rounded-[1.75rem]`.

## 8. Iconography

- Lucide icons inherit `size={16}`, `strokeWidth={1.5}`, `shrink-0`, `select-none` from
  `LucideProvider`. Do not repeat `size-4`/`shrink-0` on a default icon.
- Non-default sizes are explicit and rare: `size-3.5` inline meta, `size-5` large status/empty.
- Icon-only actions have `aria-label` and a tooltip when the icon is not universally understood.
- Icons never replace text for status; pair them.
- Brand icons are SVG components; their hex is exempt.

## 9. Components

### 9.1 Component inventory

| Component | File | Notes |
| --- | --- | --- |
| `Card` | `shared/ui/core/card.tsx` | `default/compact/row`, `tone`, `interactive` |
| `AppButton` | `shared/ui/core/button.tsx` | `default/secondary/outline/ghost/destructive/link`, `sm/default/lg/icon` |
| `LoadingButton` | `shared/ui/kit/loading-button.tsx` | `isLoading` required; keeps label/width, optional delay/minDuration |
| `AppBadge` | `shared/ui/core/badge.tsx` | `default/outline/secondary/destructive` |
| `StatusBadge` | `shared/ui/kit/status-badge.tsx` | canonical status: `success/warning/danger/info/neutral`, `default/sm` |
| `Input`, `Textarea` | `shared/ui/core` | Input 36px; Textarea min 60px |
| `Select`, `Checkbox`, `Switch`, `Label` | `shared/ui/core` | shared control scale |
| `Dialog`, `Sheet` | `shared/ui/core` | focus trap, Escape, footer actions |
| `Popover`, `Tooltip`, `DropdownMenu` | `shared/ui/core` | anchored overlays |
| `Tabs`, `Command` | `shared/ui/core` | segmented navigation, searchable pickers |
| `Table` | `shared/ui/core/table.tsx` | header 12px, body 14px |
| `Progress` | `shared/ui/core/progress.tsx` | track 4–8px |
| `Skeleton` | `shared/ui/core/skeleton.tsx` | matches final geometry |
| `Empty` | `shared/ui/core/empty.tsx` | icon/logo, title, description, action |
| `Avatar` | `shared/ui/kit/app-avatar.tsx` | fallback initials |
| `DangerActionDialog` | `shared/ui/kit/danger-action-dialog.tsx` | destructive confirmation |
| `CodeWindow` | `shared/ui/kit/code-window.tsx` | code/mono surface |
| `StatCard` | `entities/repo/ui/stat-card.tsx` | KPI, optional meter/tone |
| `RepoCard` | `entities/repo/ui/repo-card.tsx` | row/brief |
| `ConnectionCard` | `entities/connection/ui/connection-card.tsx` | row/tile |
| `NotificationCard` | `entities/notification/ui/notification-card.tsx` | feed row |
| `ApiKeyCard` | `entities/api-key/ui/api-key-card.tsx` | key row |
| `RepoPullCard` | `entities/pr/ui/repo-pull-card.tsx` | PR row |
| `HighFiveCard` | `entities/high-five/ui/high-five-card.tsx` | author row |
| `PrDetailsSummary` | `features/repo-pulls/ui/pr-details-summary.tsx` | definition rows |

### 9.2 Card

- `size="default"` — section, form, settings group.
- `size="compact"` — KPI, small widget.
- `size="row"` — repeated records (repos, connections, keys, sessions).
- `tone="danger"` — irreversible actions.
- `tone="selected"` — selected state.
- `interactive` — only when the whole card is clickable (background on hover, no gray border).

Rules: no bordered card inside a card; use `border-t` rows. `CardTitle` and `CardDescription`
size themselves from the card: 14px/12px in `compact`/`row`, 16px/14px in `default`. Do not add a
`text-*` size unless you need a hero value (`text-xl` only for the repo hero name). One primary
action in the header or footer.

Padding model:

| Part | Horizontal padding | Vertical |
| --- | --- | --- |
| `Card` default | none — comes from subcomponents | `py-6` |
| `CardHeader` / `CardContent` / `CardFooter` | `px-6` | header gap 2, content none |
| `Card` `compact` / `row` | `px-4` on the card | `py-4` / `py-3.5` |

Consequences:

- Do not put `CardHeader`/`CardContent` inside `compact` or `row`; they bring `px-6` and the card
  gets 24px + 16px. Use direct children instead.
- `Card` alone has no horizontal padding. For a custom body, add `px-6` once.
- `CardAction` is the only sanctioned way to place an action in the header; it uses the two-column
  grid of `CardHeader`.
- A compact card stacked under a default card may use `px-6` to align its left edge; this is the
  only padding override and it is intentional.

`asChild` exists on `Card`, `AppButton` and `AppBadge`. A button-link is always

```tsx
<AppButton asChild size="sm" variant="outline">
  <Link href={href}>Open</Link>
</AppButton>
```

Build a section card:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base">Documentation</CardTitle>
    <CardDescription>6 files · 5 ready</CardDescription>
    <CardAction>
      <AppButton asChild size="sm" variant="ghost">
        <Link href={docsHref}>Open</Link>
      </AppButton>
    </CardAction>
  </CardHeader>

  <CardContent className="flex flex-col">
    <div className="border-t py-2 first:border-t-0 first:pt-0">...</div>
  </CardContent>
</Card>
```

Build a compact card:

```tsx
<Card size="compact" className="gap-3">
  <div className="flex items-center gap-2">
    <div className="flex size-8 shrink-0 items-center justify-center rounded-tile bg-surface-hover">
      <Icon />
    </div>
    <CardTitle className="min-w-0 flex-1">Quality</CardTitle>
    <StatusBadge size="sm" tone="success">87</StatusBadge>
  </div>

  <div className="flex flex-col">
    <div className="border-t py-2 first:border-t-0 first:pt-0">...</div>
  </div>
</Card>
```

Build a row:

```tsx
<Card size="row">
  <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-surface-hover">
    <Icon />
  </span>

  <div className="min-w-0 flex-1">
    <CardTitle className="truncate">doxynix/web</CardTitle>
    <p className="truncate text-muted-foreground text-xs">Next.js · main</p>
  </div>

  <StatusBadge size="sm" tone="success">active</StatusBadge>
</Card>
```

### 9.3 Button

Variants: `default` (primary), `secondary`, `outline`, `ghost`, `destructive`, `link`.
Sizes: `sm` 32px, `default` 36px, `lg` 40px; `icon` 36, `icon-sm` 32, `icon-xs` 28.

- One primary action per surface. Secondary actions are `outline`/`ghost`.
- Destructive actions use `destructive` and a confirmation for irreversible operations.
- Full-width CTA only in dialogs and on mobile.
- Loading buttons keep their label and width. Use `LoadingButton` (spinner + disabled); do not
  replace the label with a spinner.

### 9.4 Badge

- `StatusBadge` is the canonical status badge: soft surface, status border, status text, optional
  dot, sizes `default` and `sm`. Use it for connection/session/plan/2FA/repo status.
- Raw `AppBadge` is for non-status tags (visibility, scopes, topics, versions).
- Status badges use the status color plus a border, not a saturated fill.
- Text is short: a count, a state, a type. No sentences.
- Pills for filters may use `rounded-full`; data tags use `outline`.

Tone vocabulary:

- **destructive** — the semantic color token and action variant (`bg-destructive`,
  `text-destructive`, `variant="destructive"`).
- **danger** — a component tone (`Card tone`, `StatCard tone`, `StatusBadge tone`) that maps to the
  destructive color. Use it for surfaces and badges, not for CTA variants.
- **error** — the legacy alias token `--color-error` (`text-error`). Keep it for existing data
  mappings; new code uses `destructive`.

### 9.5 Inputs and forms

- Label above, helper below, error below the field.
- Errors use `text-destructive` plus a message, never color alone.
- Disabled controls keep readable contrast and a real `disabled`.
- Do not mix `h-8` and `h-10` in one form.
- Required fields are marked in the label, not only by color.

### 9.6 Overlays

- Dialog: focus trap, Escape closes, title + description, actions in the footer.
- Popover: anchored to the trigger, closes on outside click/Escape.
- Tooltip: supplemental only; never the sole label.
- Tabs: arrow-key navigation, active state via background, not underline only.
- Sheet: used for side panels; header and footer stay fixed, body scrolls.

### 9.7 Data display

- Tables: header 12px muted, body 14px; numeric columns right-aligned.
- Definition lists: label + dotted leader + value (`PrDetailsSummary`).
- Feeds: one container, rows with `border-t`, timestamp 12px.
- Progress: track `bg-muted`, indicator semantic color, 4–8px height.
- Skeletons match the final row/header/chart geometry.

## 10. Patterns

### 10.1 Dashboard

- Header: page title + sticky date range; primary actions live in the section header, not in the
  page header.
- KPI row: compact cards, one tone per card, value + meter + description.
- Main column: recent repos, action items, trends.
- Right rail: ecosystem, risks, health, languages, activity.
- Do not mix card sizes in one row; one row = one size.

### 10.2 Settings

- Settings layout owns `h1` “Settings”; each page uses `h2` + description, then one grouped
  `Card` with sections.
- A page whose card already carries the page title (Appearance) may omit the page `h2`; the card
  header is then the page header.
- Sections: title + description, controls aligned right, hairline between sections.
- Destructive settings live in their own danger section, not mixed with appearance.

### 10.3 Lists and feeds

- One container card; rows separated by `border-t`.
- Primary value first, meta second, actions on hover (always visible on touch).
- Empty state uses the same container and one clear action.
- Pagination: sentinel at the end, skeleton rows while loading.

### 10.4 Filters and search

- Toolbar: search, filters, reset, view toggle.
- Date range: presets + calendar; one header with start/end.
- Active filters are removable chips; reset is an icon with a tooltip.
- Empty search shows a result message, not a generic “no data”.

### 10.5 Feedback

- Loading: skeleton of the same size; no layout jump.
- Empty: title, description, one action; no dead end.
- Error: message via `useErrorMessage`, retry action, no raw stack traces.
- Success: toast; inline confirmation only for local changes.

### 10.6 Danger

- Destructive action in a `DangerActionDialog` with a clear title and consequence.
- Irreversible operations require typed confirmation.
- Danger rows use `tone="danger"`, no hover border; primary action is destructive.
- Safe alternatives (“cancel”, “back”) are always visible.

### 10.7 Agent panel

- Docked to the right/bottom edge, `border-l`/`border-t`, no card-in-card.
- Header: name + actions; empty state: logo + three suggestions.
- Composer fixed at the bottom; message list scrolls independently.
- Expanded/collapsed widths are controlled by the agent, not by page layout.

## 11. States

Every interactive surface defines:

- **hover** — subtle background (`surface-hover`), no gray border on cards;
- **focus-visible** — `ring-2 ring-ring/80`, never remove the outline;
- **active** — pressed state, no layout shift;
- **disabled** — `opacity-50` plus real `disabled`;
- **loading** — spinner or skeleton of the same size;
- **empty** — same geometry, one action;
- **error** — message + retry, no stack traces;
- **selected** — `surface-selected` or a check, not only a border color.

## 12. Motion

- Default: `transition-standard` 150ms ease-out.
- Enter/exit: 200–280ms; drawers `--ease-drawer`.
- Animate opacity and transform; avoid width/height/top/left unless unavoidable.
- No scale on hover for cards; no decorative bounce.
- Respect `prefers-reduced-motion` and the app “Reduce motion” setting; no transform, opacity only.
- Spinners are functional; decorative icons do not animate.

## 13. Accessibility

- Focus: `ring-2 ring-ring/80`; visible on every interactive element.
- Target size: at least 24×24px; primary controls 32–36px.
- Keyboard: dialogs trap focus and close on Escape; menus/tabs use arrows; icon buttons focusable.
- ARIA: icon-only buttons have `aria-label`; charts have labels or a data alternative; errors are
  announced.
- Do not use color alone for status, selection, or errors.
- Do not remove `outline` without an equivalent focus style.
- Truncation keeps a `title`/tooltip with the full value.

Per component:

| Component | Keyboard / ARIA |
| --- | --- |
| Button | Enter/Space; `aria-label` for icon-only |
| Dialog | focus trap, Escape, `aria-labelledby`/`aria-describedby` |
| Tabs | arrows move focus, `aria-selected`, roving tabindex |
| Select | arrows/Enter/Escape; listbox semantics |
| Tooltip | focus/hover, `aria-describedby`, dismissible |
| Table | header cells, caption or label |
| Chart | text summary or accessible table alternative |

## 14. Content and i18n

- Sentence case for labels and titles; no decorative uppercase.
- All copy in `messages/*.json` via `next-intl`; no hardcoded user-facing strings.
- 12 locales; new keys go into every locale and pass `lint:locales`.
- Plurals use ICU; dates/numbers use `toLocaleString(locale)`.
- Empty states explain the next action; errors say what happened and what to do.
- Do not use “...” as a label; use the ellipsis character in prose, not buttons.
- Buttons are verbs; confirmations name the consequence.

Namespaces:

| Namespace | Use |
| --- | --- |
| `Dashboard` | product UI, settings, cards (the default) |
| `Common` | save/cancel/create/delete/status/theme |
| `Sessions`, `Welcome`, `OnboardingChecklist`, `Landing` | page/flow-specific copy |

Adding copy:

1. Add `snake_case` keys to `messages/en.json`; prefix with the feature (`settings_`, `repo_`,
   `billing_`) and keep them short.
2. Copy the key into the other 11 locales with a translation; never leave `en` only.
3. Use `useTranslations("Dashboard")` in client code, `getTranslations` in Server Components.
4. Plurals: `t("key", { count })` with ICU `{count, plural, ...}` in every locale.
5. Run `bun --filter @doxynix/web lint:locales` and `lint:i18n-usage`.

`messages/en.d.json.ts` is generated by next-intl. Do not edit it by hand; restart the dev server
if the types are stale. `scripts/check-locales.ts` enforces the key shape across all 12 files.

## 15. Data visualization

- Series colors from `--chart-1…5`; no raw palette/hex. Provider language colors are the documented
  exception (§21).
- Axes/grid muted; data is the only strong color.
- Multi-series charts have a legend; tooltips use the shared surface.
- No 3D, no gradients for meaning; dashed = forecast/projection, documented in the legend.
- Numbers align with `tabular-nums` in tables; percentages use one decimal at most.

## 16. Responsive behavior

- Verify 360px, 768px, 1024px, 1440px.
- Sidebars/inspectors collapse before squeezing content; use container queries.
- Cards switch to one column; rows keep the primary value and hide secondary meta.
- Tables scroll inside their card or become rows; no page-level horizontal scroll.
- Touch targets ≥24px; icon actions are always visible on touch (no hover-only).

## 17. Do / Don't

| Do | Don't |
| --- | --- |
| `text-2xs` for micro meta | `text-[10px]` |
| `bg-success/10 text-success` | `bg-emerald-500/10 text-emerald-500` |
| `border-border` | `border-[#2a2a2a]` |
| `Card size="compact"` | A custom div with `rounded-2xl border p-4` |
| Rows separated by `border-t` | A bordered card inside a card |
| Actions on hover in a row | A full-width CTA inside every row |
| `aria-label` on an icon button | A bare icon with no accessible name |
| One primary action per surface | Two primary buttons in one header |
| Sentence case | Decorative `uppercase` labels |

## 18. Governance

### 18.1 Ownership

- **Area owner** — the maintainer of the area or the author of the PR that changes it.
- **Reviewer** — the person approving the change.
- **Design reviewer** — optional; required when the change touches more than one surface.

There is no separate design-system team in this repo. If no owner is named for a change, the PR
author is the owner and the reviewer is the approver; do not block on an unnamed role.

### 18.2 Contribution

1. Open a PR/issue with the use case, affected surfaces, and screenshots (light/dark).
2. Name the tokens/variants the change uses; propose a new token only if no role fits.
3. Acceptance: used on at least two surfaces, or fixes an accessibility gap; no >70% overlap with
   an existing component.
4. Add the card to the gallery and the component inventory.
5. Ship with the PR checklist; no separate “design follow-up”.

### 18.3 Versioning and deprecation

- Tokens and components version with the app; no separate package yet.
- Breaking visual changes: changelog entry + migrate all call sites in the same PR.
- Deprecation: mark the component/token, document the replacement, keep it for one release cycle.
- A rename is a breaking change; add a temporary alias if it cannot be migrated at once.

### 18.4 Definition of done

- variants and states; dark mode; keyboard/focus; empty/loading/error;
- i18n keys in 12 locales; gallery entry; `check:styles`; `type-check`;
- no arbitrary text/colors/tracking; no nested bordered cards.

## 19. Enforcement

### 19.1 Automated

Utility-level values and allowed ranges are in `docs/TAILWIND.md`. The checker enforces the three
rules below.

```bash
bun --filter @doxynix/web check:styles
```

Forbids:

- arbitrary font sizes (`text-[...]`);
- raw Tailwind palette classes;
- `tracking-*`.

Runs in `validate`. It scans `.ts` and `.tsx`.

### 19.2 Reviewed

The checker does not catch semantics. Review these in PRs:

- `uppercase` outside brand abbreviations;
- `font-mono` outside code;
- `leading-*` overrides;
- spacing/radii outside the scale;
- new colors instead of roles;
- component variants bypassed with `className`;
- accessibility states.

### 19.3 Visual

`docs/mockups/final-cards.html` is the canonical gallery; the other files in `docs/mockups/` are
historical exploration. Every new card is added to the canonical gallery with mock data and checked
in light and dark themes. Screenshots are the second gate when available.

Add a card to the gallery:

1. Add a `<section class="card-section" id="...">` with `.section-head`, `.grid-2`/`.grid-3` and
   the `.card` markup that matches the component.
2. Use the token classes (`.card`, `.metric`, `.status`, `.list`), not new colors or font sizes.
3. Add an entry to the sidebar nav.
4. Run `bunx biome check --write docs/mockups/final-cards.html`.

The gallery is manual, not generated. When in doubt, render the real component in the app.

## 20. Migration playbook

1. **Inventory** — list arbitrary values and raw colors; group by role.
2. **Tokens** — add the missing role/step in `globals.css`; do not duplicate values.
3. **Replace** — map to the nearest token; keep visual diff small.
4. **Check** — run `check:styles`; extend it for the rule you just migrated.
5. **Gallery** — add the migrated card; compare light/dark.
6. **Cleanup** — remove the old class/constant; update the changelog.

## 21. Exceptions

- `// style-ok` at the end of a line disables the three automated checks on that line. Layout and
  art exceptions are review-only; the checker does not inspect them.
- Art and mockups (welcome previews, appearance theme preview, auth illustrations) may use exact
  dimensions and colors. They are pictures, not UI.
- Brand SVGs may contain hex.
- Provider data may contain hex colors (GitHub language colors); pass them inline, not as classes.
- The QR code uses `bg-white` for scannability.
- Third-party widgets (React Flow, code editor, chart internals) may need library-specific values;
  keep them inside the wrapper and expose tokens at the boundary.

## 22. Decision tree

1. Existing token? Use it.
2. Same pattern twice? Make a variant.
3. One-off layout? Arbitrary value; review-only (the checker does not inspect layout).
4. New semantic color/status? Add it to `globals.css`, document it here.
5. New font size? Almost never. Use the scale; if required, add a `--text-*` token and update the
   checker.
6. New radius? Use the role table; add a token only for a new role.
7. Not sure? Prefer the quieter option: muted surface, one accent, hairline border.

## 23. FAQ

**Can I use a raw color for a chart?** No. Use `--chart-*`; if a series needs a new hue, add a
chart token, not a hex.

**Can I add a one-off size?** Only for layout. Text, radius and color must be tokens.

**Why is there no shadow on cards?** Hierarchy comes from spacing, border and type. Shadows are
reserved for overlays.

**Why is letter-spacing zero?** Tracking is not part of the system; it made the same text look
different across components.

**How do I add a theme?** Add the semantic mapping in `globals.css` and an entry in the appearance
options; do not touch components.

**What if the checker flags art?** Add `// style-ok` on that line and keep the exception local.

## 24. Adoption status (2026-11-21)

Migrated and verified:

- typography — 0 arbitrary font sizes; 60 usages of `text-2xs`, 1 of `text-metric`;
- color — 0 palette-step classes; `bg-white` remains in the QR code as a documented exception;
- tracking — 0 `tracking-*` classes; global button/heading letter-spacing is 0;
- status — `StatusBadge` adopted for connection, repo, summary, session and 2FA; a few legacy
  badges still use raw `AppBadge` classes;
- cards — table header is 12px; `interactive` removed from non-clickable connection/API-key cards;
- radii — `2xs`, `xs`, `tile` added; structural/art radii remain as documented exceptions;
- enforcement — `check:styles` runs in `validate` and scans `.ts`/`.tsx`.

Known drift (reviewed, not automated yet):

- `uppercase` in 7 files — marketing, error pages, opengraph, mermaid and the welcome preview;
- `font-mono` in 32 files — many are code/terminal; audit the rest;
- `leading-*` in 15 files — prose/landing; keep only where intentional;
- 3 arbitrary radii and 19 arbitrary spacing values — art/layout; review-only;
- no visual regression suite yet; the gallery is the manual contract.

## 25. Changelog

- **2026-11-21** — design system v1.1: typography scale (`text-2xs`, `text-metric`), zero
  letter-spacing, semantic color migration, radius roles (`2xs`, `xs`, `tile`), component
  inventory, patterns, governance, `check:styles`, gallery contract.
