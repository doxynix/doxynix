# Tailwind usage in Doxynix

How each Tailwind property is used in this app: allowed utilities, values, and where it belongs.
`DESIGN.md` is the visual contract; this file is the utility-level reference.

Sources: Tailwind CSS v4 docs (theme, utilities, v4.1–v4.3 additions). Values are aligned with
`apps/web/src/app/globals.css` and the components.

## Legend

| Status | Meaning |
| --- | --- |
| ✅ | Default. Use freely within the listed values. |
| 🟡 | Rare. Only for the named case; prefer a component or a token. |
| 🚫 | Avoid in product UI. Use the listed alternative. |
| 🎨 | Art / marketing / mockups only. Not product UI. |

Global rules:

- Tokens first: colors, type, radius and spacing come from `DESIGN.md`; raw palette and arbitrary
  font sizes are forbidden.
- Mobile-first: base styles for 360px, then `sm/md/lg/xl/2xl`.
- Prefer container queries (`@container`, `@min-*`, `@max-*`) inside cards, sidebars and panels.
- Use logical properties (`ms/me/ps/pe`, `start/end`, `inline/block`) when direction matters.
- No `dark:` color pairs in feature code; themes remap semantic roles.
- Arbitrary values only for one-off layout/art, never for typography or colors.

## 1. Layout

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| aspect-ratio | `aspect-square`, `aspect-video`, `aspect-[4/3]` | ✅ avatars, thumbnails, media. `aspect-square` for icons/avatars; `aspect-video` for embeds. Arbitrary ratios 🎨. |
| columns | `columns-2`, `columns-3` | 🚫 product layout; use grid. 🎨 prose/landing. |
| break-after | `break-after-*` | 🚫 print only. |
| break-before | `break-before-*` | 🚫 print only. |
| break-inside | `break-inside-avoid` | 🚫 print only. |
| box-decoration-break | `box-decoration-clone` | 🚫 rare inline art; not UI. |
| box-sizing | `box-border` | 🚫 preflight already sets border-box; never use `box-content`. |
| display | `flex`, `grid`, `block`, `inline-flex`, `inline`, `hidden`, `contents` | ✅ `flex`/`grid` for layout, `block` for page/text, `inline-flex` for controls, `hidden` for responsive, `contents` rare for grid flattening. |
| float | `float-left`, `float-right` | 🚫 legacy; use flex/grid. |
| clear | `clear-*` | 🚫 legacy; use flex/grid. |
| isolation | `isolate` | 🟡 only for blend/mask art or a deliberate stacking context. |
| object-fit | `object-cover`, `object-contain` | ✅ `cover` for avatars/photos, `contain` for logos; no `object-fill`. |
| object-position | `object-center`, `object-top` | ✅ `center` default; `top` for portraits. |
| overflow | `overflow-hidden`, `overflow-auto`, `overflow-x-auto`, `overflow-y-auto`, `overflow-visible`, `overscroll-contain` | ✅ `hidden` for cards/media and rounded clipping; `auto` for scroll areas; `x-auto` for tables; `overscroll-contain` for modals/drawers. |
| overscroll-behavior | `overscroll-contain`, `overscroll-none` | ✅ `contain` for dialogs/drawers; `none` for map/canvas. |
| position | `relative`, `absolute`, `fixed`, `sticky`, `static` | ✅ `relative` for anchors; `absolute` overlays; `fixed` shell/agent; `sticky` headers/date range. |
| top / right / bottom / left | `inset-0`, `inset-x-0`, `inset-y-0`, `top-0`, `top-2 right-2`, `start-*`, `end-*` | ✅ `inset-0` overlays; `top-2 right-2` close buttons; `start/end` for RTL. Allowed steps 0/1/2/3/4/6/8/12. |
| visibility | `visible`, `invisible`, `sr-only` | ✅ `invisible` when layout must stay; `sr-only` for a11y; otherwise `hidden`. |
| z-index | `z-0`, `z-10`, `z-20`, `z-50`, `z-100` | ✅ `0` content, `10` sticky/raised, `20` dropdown, `50` overlay/agent, `100` skip link. `z-[9999]` only inside library wrappers (agent handle). |

## 2. Flexbox and Grid

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| flex-basis | `basis-full`, `basis-1/2`, `basis-1/3`, `basis-0` | 🟡 prefer width/grid; `basis-0` with `grow` for equal columns. |
| flex-direction | `flex-row`, `flex-col` | ✅ mobile-first `flex-col`, desktop `flex-row`; avoid `*-reverse`. |
| flex-wrap | `flex-wrap`, `flex-nowrap` | ✅ `wrap` for chips/tags; `nowrap` for single-line controls. |
| flex | `flex-1`, `flex-none`, `flex-auto` | ✅ `flex-1` fill, `flex-none` fixed actions/icons; avoid `flex-initial` unless required. |
| flex-grow | `grow`, `grow-0` | ✅ `grow` for fill; prefer `flex-1` when basis is 0. |
| flex-shrink | `shrink-0`, `shrink` | ✅ `shrink-0` on icons, avatars, badges, actions; default `shrink` elsewhere. |
| order | `order-first`, `order-last`, `order-1..3` | 🟡 visual reorder only; keep DOM order for a11y. |
| grid-template-columns | `grid-cols-1`, `2`, `3`, `4`, `5`, `6`, `12` | ✅ page/card grids. `grid-cols-[1.6fr_1fr]` is layout-only (style-ok). |
| grid-column | `col-span-1`, `2`, `3`, `4`, `6`, `12` | ✅ cards spanning a grid; `col-start-*` rare. |
| grid-template-rows | `grid-rows-*`, `auto-rows-min` | 🟡 fixed rows rare; `auto-rows-min` for card headers. |
| grid-row | `row-span-*`, `row-start-*` | 🟡 overlays/auth stacking; avoid for normal flow. |
| grid-auto-flow | `grid-flow-row` | ✅ default; avoid `dense` (order surprises). |
| grid-auto-columns | `auto-cols-*` | 🎨/rare carousels. |
| grid-auto-rows | `auto-rows-min`, `auto-rows-fr` | 🟡 header rows; rare elsewhere. |
| gap | `gap-1`, `1.5`, `2`, `2.5`, `3`, `4`, `6`, `8`, `10`, `12`; `gap-x`, `gap-y` | ✅ card grids 16/24, rows 12, controls 8. Avoid `gap-7/9/11`. |
| justify-content | `justify-start`, `justify-between`, `justify-center`, `justify-end` | ✅ `between` toolbars, `center` empty/hero, `end` actions; avoid `around/evenly` in product. |
| justify-items | `justify-items-start`, `justify-items-center` | 🟡 forms/empty states; default start. |
| justify-self | `justify-self-end`, `justify-self-center` | 🟡 action cells; rare. |
| align-content | `content-start`, `content-center`, `content-between` | 🟡 multi-row grids/empty states; rare. |
| align-items | `items-start`, `items-center`, `items-stretch`, `items-baseline` | ✅ `start` for content blocks, `center` rows/controls, `stretch` cards, `baseline` text rows. |
| align-self | `self-start`, `self-center`, `self-end` | 🟡 override one item; rare. |
| place-content | `place-content-center` | ✅ empty states. |
| place-items | `place-items-center` | ✅ icon tiles, empty states. |
| place-self | `place-self-center` | 🟡 rare; prefer align/justify. |

## 3. Spacing

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| padding | `p-0`, `0.5`, `1`, `1.5`, `2`, `2.5`, `3`, `4`, `5`, `6`, `8`, `10`, `12`; `px/py/pt/pr/pb/pl` | ✅ cards 16/24, rows 12–16, controls 8–12. Avoid `p-7/9/11/13+`. |
| margin | `m-0`, `mx-auto`, `mt-*`, `ml-auto`, `-mx-*` | ✅ `mx-auto` containers, `mt` rhythm, `ml-auto` actions; negative only for full-bleed rows. Same steps as padding. Avoid `space-y-*` when `gap` works. |
| logical spacing | `ps-*`, `pe-*`, `ms-*`, `me-*` | ✅ when LTR/RTL matters (nav, menus, badges). Otherwise physical padding is fine. |

## 4. Sizing

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| width | `w-full`, `w-auto`, `w-fit`, `w-*` tokens, `w-screen` | ✅ `w-full` forms/cards, `w-fit` chips/actions, tokens for fixed widths. Arbitrary widths layout-only. |
| min-width | `min-w-0`, `min-w-fit`, `min-w-*` | ✅ **`min-w-0` is required** on flex children that truncate; `min-w-fit` for chips. |
| max-width | `max-w-xs/sm/md/lg/xl/2xl/3xl/4xl/6xl/screen`, `max-w-[80ch]` | ✅ dialog/invite widths, prose `80ch`; avoid arbitrary in cards. |
| height | `h-full`, `h-screen`, `h-dvh`, `h-*` | ✅ charts `h-75`, radar `h-56`, rows by content; avoid fixed heights for text. |
| min-height | `min-h-0`, `min-h-screen`, `min-h-*` | ✅ `min-h-0` in flex scroll chains; skeletons; textarea `min-h-15`. |
| max-height | `max-h-80`, `max-h-[22rem]`, `max-h-[70vh]`, `max-h-dvh` | ✅ dropdowns/lists/dialogs; use `dvh` on mobile. |
| inline-size | `inline-full`, `inline-auto`, `inline-*` | 🟡 logical sizing; use only when writing-mode/RTL matters. |
| min-inline-size | `min-inline-0`, `min-inline-*` | 🟡 logical equivalent of `min-w-0`. |
| max-inline-size | `max-inline-*` | 🟡 logical max width. |
| block-size | `block-full`, `block-*` | 🟡 logical height; prefer `h-*` in LTR UI. |
| min-block-size | `min-block-0`, `min-block-*` | 🟡 logical scroll chains. |
| max-block-size | `max-block-*` | 🟡 logical max height. |

## 5. Typography

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| font-family | `font-sans`, `font-mono` | ✅ `sans` default; `mono` only code, pre, terminal, diff paths, shortcuts. |
| font-size | `text-2xs`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-metric` | ✅ exact scale from `DESIGN.md`; no `text-[...]`. |
| font-smoothing | `antialiased` | ✅ body/root only; not per component. |
| font-style | `italic`, `not-italic` | 🟡 quotes/emphasis; reset for UI labels. |
| font-weight | `font-normal`, `font-medium`, `font-semibold`, `font-bold` | ✅ 400 body, 500 controls/meta, 600 cards, 700 page titles only. |
| font-stretch | — | 🚫 use the variable font defaults. |
| font-variant-numeric | `tabular-nums`, `slashed-zero`, `proportional-nums` | ✅ `tabular-nums` for tables/metrics; `slashed-zero` in code. |
| font-feature-settings | — | 🚫 use `font-variant-numeric` utilities. |
| letter-spacing | `tracking-normal` only | 🚫 no tracking; reset only. |
| line-clamp | `line-clamp-1`, `2`, `3`, `4` | ✅ descriptions and PR bodies; always add a `title`/tooltip for full text. |
| line-height | from text tokens; `leading-none` icons; `leading-relaxed` prose | ✅ tokens; `none` for icon-only; `relaxed` only prose/landing. |
| list-style-image | — | 🚫 use icons for custom bullets. |
| list-style-position | `list-inside`, `list-outside` | ✅ `inside` prose, `outside` default. |
| list-style-type | `list-none`, `list-disc`, `list-decimal` | ✅ `none` for nav/menus, `disc/decimal` prose. |
| text-align | `text-left`, `text-center`, `text-right`, `text-start`, `text-end` | ✅ left default, center empty/hero, right numeric/actions, logical in RTL. |
| color | semantic only: `text-foreground`, `text-muted-foreground`, `text-success`, `text-warning`, `text-destructive`, `text-info`, `text-chart-*`, `text-brand-*` | ✅ no palette/hex. |
| text-decoration-line | `underline`, `no-underline`, `line-through` | ✅ links underline on hover, buttons none, completed items line-through. |
| text-decoration-color | `decoration-border`, `decoration-primary`, `decoration-success` | ✅ semantic only. |
| text-decoration-style | `decoration-solid`, `decoration-dashed`, `decoration-dotted` | 🟡 dashed/dotted placeholders; solid default. |
| text-decoration-thickness | `decoration-1`, `decoration-2` | 🟡 links/active tabs; 1px default. |
| text-underline-offset | `underline-offset-2`, `underline-offset-4` | ✅ links; 2 default. |
| text-transform | `normal-case`, `capitalize` | 🚫 `uppercase` except brand abbreviations; `capitalize` only enum labels. |
| text-overflow | `truncate`, `text-ellipsis` + `overflow-hidden whitespace-nowrap` | ✅ `truncate` single line; no clipping without ellipsis. |
| text-wrap | `text-balance`, `text-pretty`, `text-nowrap` | ✅ balance headings, pretty paragraphs; `nowrap` only via `whitespace-nowrap`. |
| text-indent | — | 🚫 no indentation. |
| tab-size | `tab-2`, `tab-4` | ✅ `tab-2` in code blocks; default elsewhere. |
| vertical-align | `align-middle`, `align-top`, `align-baseline` | ✅ icons `middle`, table cells `top`, text default. |
| white-space | `whitespace-normal`, `whitespace-nowrap`, `whitespace-pre`, `whitespace-pre-wrap` | ✅ nowrap buttons/badges/tables, pre code, pre-wrap logs; normal default. |
| word-break | `break-normal`, `break-all`, `break-keep` | ✅ `break-all` for tokens/hashes; default otherwise. |
| overflow-wrap | `wrap-break-word`, `wrap-anywhere`, `wrap-normal` | ✅ long names/URLs `wrap-break-word`; flex long strings `wrap-anywhere`; normal default. |
| hyphens | `hyphens-none`, `hyphens-manual`, `hyphens-auto` | 🟡 `auto` prose with `lang`; none for code/URLs. |
| content | `content-none` | 🚫 custom pseudo text; use components. |

## 6. Backgrounds

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| background-attachment | — | 🚫 `fixed` causes jank; use a fixed element if needed. |
| background-clip | `bg-clip-text`, `bg-clip-padding` | 🎨 text gradients; padding clip rare. |
| background-color | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-accent`, `bg-primary`, status `/10`, `bg-surface-hover`, `bg-surface-selected` | ✅ semantic only; opacity modifiers 5/10/30. |
| background-image | `bg-none`, `bg-linear-to-*` | 🎨 gradients on landing/art; product surfaces stay flat. `bg-[url()]` art only. |
| background-origin | — | 🚫 rare; not needed. |
| background-position | `bg-center`, `bg-top` | 🎨 images; default center. |
| background-repeat | `bg-no-repeat`, `bg-repeat` | 🎨 images/patterns; no-repeat for photos. |
| background-size | `bg-cover`, `bg-contain` | 🎨 hero/photos `cover`, logos `contain`. |

## 7. Borders

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| border-radius | `rounded-2xs`, `rounded-xs`, `rounded-tile`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full` | ✅ roles from `DESIGN.md`; no `rounded-[10px]` except art. |
| border-width | `border`, `border-0`, `border-2`, `border-t/b/l/r` | ✅ 1px default, 0 reset, 2 focus/selected, side borders for rows. |
| border-color | `border-border`, `border-strong`, `border-accent`, status `/30`, `border-input` | ✅ semantic only. |
| border-style | `border-solid`, `border-dashed`, `border-dotted`, `border-none` | ✅ dashed empty/skeleton, dotted leaders, none with ring. |
| outline-width | `outline-0`, `outline-2`, `outline-4` | 🟡 focus uses `ring-2`; outline only for forced-colors fallback. |
| outline-color | `outline-ring`, semantic | 🟡 same. |
| outline-style | `outline-hidden`, `outline-solid` | ✅ `outline-hidden` when a custom ring is used. |
| outline-offset | `outline-offset-2`, `outline-offset-4` | 🟡 focus on colored surfaces. |

## 8. Effects

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| box-shadow | `shadow-none`; overlays get shadows from global `[data-slot]` rules | ✅ cards flat; no `shadow-*` in feature/card code; landing art may use `shadow-sm/md/lg`. |
| text-shadow | `text-shadow-none` | 🚫 product; `text-shadow-*` only hero/landing art. |
| opacity | `opacity-100`, `opacity-70`, `opacity-50`, `opacity-0` | ✅ muted 70, disabled 50, hover reveal 0; no random opacity. |
| mix-blend-mode | `mix-blend-*` | 🎨 art/overlays only. |
| background-blend-mode | `bg-blend-*` | 🎨 art only. |
| mask-clip | `mask-clip-*` | 🎨 art only. |
| mask-composite | `mask-composite-*` | 🎨 art only. |
| mask-image | `mask-*`, `mask-[url()]` | 🎨 art only. |
| mask-mode | `mask-alpha`, `mask-luminance` | 🎨 art only. |
| mask-origin | `mask-origin-*` | 🎨 art only. |
| mask-position | `mask-center`, `mask-top-*` | 🎨 art only. |
| mask-repeat | `mask-repeat-*` | 🎨 art only. |
| mask-size | `mask-cover`, `mask-contain`, `mask-*` | 🎨 art only. |
| mask-type | `mask-type-*` | 🎨 SVG art only. |

## 9. Filters

All filters are 🎨 unless noted. Product UI uses them only for overlays.

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| filter | `filter-none` | 🚫 product; art only. |
| blur | `blur-sm`, `blur-md`, `blur-lg` | 🎨 glows; `backdrop-blur-*` for sticky headers/popovers. |
| brightness | `brightness-*` | 🎨 art. |
| contrast | `contrast-*` | 🎨 art. |
| drop-shadow | `drop-shadow-*` | 🎨 art; no card shadows. |
| grayscale | `grayscale`, `grayscale-0` | 🟡 inactive logos; not for disabled UI. |
| hue-rotate | `hue-rotate-*` | 🎨 art. |
| invert | `invert` | 🎨 art. |
| saturate | `saturate-*` | 🎨 art. |
| sepia | `sepia` | 🎨 art. |
| backdrop-filter | `backdrop-blur-sm/md` | ✅ sticky headers, popovers, command palette. |
| backdrop blur | `backdrop-blur-*` | ✅ same. |
| backdrop brightness | `backdrop-brightness-*` | 🎨 art. |
| backdrop contrast | `backdrop-contrast-*` | 🎨 art. |
| backdrop grayscale | `backdrop-grayscale-*` | 🎨 art. |
| backdrop hue-rotate | `backdrop-hue-rotate-*` | 🎨 art. |
| backdrop invert | `backdrop-invert-*` | 🎨 art. |
| backdrop opacity | `backdrop-opacity-*` | 🟡 modal scrims; use `bg-overlay` instead. |
| backdrop saturate | `backdrop-saturate-*` | 🎨 art. |
| backdrop sepia | `backdrop-sepia` | 🎨 art. |

## 10. Tables

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| border-collapse | `border-collapse` | ✅ default table; `border-separate` only with spacing. |
| border-spacing | `border-spacing-0` | ✅ 0 default; avoid spacing tables. |
| table-layout | `table-fixed`, `table-auto` | ✅ `fixed` for stable columns, `auto` for content-driven. |
| caption-side | `caption-top`, `caption-bottom` | ✅ `top` for accessible caption; bottom rare. |

## 11. Transitions and Animation

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| transition-property | `transition-standard`, `transition-colors`, `transition-transform`, `transition-none` | ✅ `transition-standard` default (color/bg/border/opacity/transform); `none` for reduced motion. |
| transition-behavior | `transition-normal`, `transition-discrete` | 🟡 `discrete` for display/overlay toggles; normal default. |
| transition-duration | `duration-150`, `200`, `300`, `0` | ✅ 150 default, 200–300 panels, 0 tests/reduced motion. |
| transition-timing-function | `ease-out`, `ease-out-expo`, `ease-in-out` | ✅ out default, out-expo panels, in-out loops. No custom bezier outside tokens. |
| transition-delay | `delay-0`, `delay-75`, `delay-150` | 🟡 stagger only. |
| animation | `animate-spin`, `animate-pulse`, `animate-in`, `animate-out` | ✅ spinner, skeleton, overlay enter/exit; no decorative loops. |

## 12. Transforms

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| backface-visibility | `backface-hidden`, `backface-visible` | 🎨 3D art only. |
| perspective | `perspective-*` | 🎨 3D art only. |
| perspective-origin | `perspective-origin-*` | 🎨 3D art only. |
| rotate | `rotate-*`, `rotate-x/y/z-*` | 🎨 art; no card rotation. |
| scale | `scale-95`, `scale-100` | 🚫 no card hover scale; active press only if it does not shift layout. |
| skew | `skew-*` | 🎨 art. |
| transform | `transform-gpu`, `transform-none` | ✅ `transform-gpu` for animated panels; `none` reset. |
| transform-origin | `origin-center`, `origin-top`, `origin-bottom` | ✅ popovers `top`, panels `center`; art. |
| transform-style | `transform-3d`, `transform-flat` | 🎨 3D art only. |
| translate | `translate-y-*`, `-translate-x-1/2`, `translate-x-0` | ✅ agent enter/exit, centered badges; not for layout. |
| zoom | `zoom-*` | 🚫 product; preview/debug only. |

## 13. Interactivity

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| accent-color | `accent-primary` | ✅ native checkboxes/radios. |
| appearance | `appearance-none`, `appearance-auto` | ✅ custom selects/inputs; reset when native. |
| caret-color | `caret-primary` | ✅ text inputs/textarea. |
| color-scheme | `scheme-dark`, `scheme-light`, `scheme-light-dark` | ✅ theme roots/inputs; not per component. |
| cursor | `cursor-pointer`, `cursor-not-allowed`, `cursor-progress`, `cursor-grab`, `cursor-grabbing` | ✅ interactive, disabled, loading, drag handles. No custom cursors. |
| field-sizing | `field-sizing-content`, `field-sizing-fixed` | 🟡 auto-growing textarea; fixed default. |
| pointer-events | `pointer-events-none`, `pointer-events-auto` | ✅ overlay/icon pass-through; restore on interactive child. |
| resize | `resize-none`, `resize-y` | ✅ textarea none; user prose y; never cards. |
| scroll-behavior | `scroll-smooth`, `scroll-auto` | 🟡 anchor navigation only; respect reduced motion. |
| scrollbar-color | `scrollbar-thumb-border-strong`, `scrollbar-track-transparent` | ✅ custom scroll containers; semantic tokens. |
| scrollbar-width | `scrollbar-thin`, `scrollbar-auto` | ✅ dense panels thin; default auto. |
| scrollbar-gutter | `scrollbar-gutter-stable`, `scrollbar-gutter-auto` | ✅ scroll containers to prevent layout shift. |
| scroll-margin | `scroll-mt-24`, `scroll-mt-*` | ✅ anchored headings under sticky header. |
| scroll-padding | `scroll-pt-24`, `scroll-p-*` | 🟡 scroll container anchors. |
| scroll-snap-align | `snap-start`, `snap-center` | 🎨/rare carousels. |
| scroll-snap-stop | `snap-always` | 🎨/rare carousels. |
| scroll-snap-type | `snap-x`, `snap-y`, `snap-none` | 🎨/rare carousels; not product lists. |
| touch-action | `touch-manipulation`, `touch-none`, `touch-pan-x`, `touch-pan-y` | ✅ buttons `manipulation`; map/canvas `none`; carousels `pan-x`. |
| user-select | `select-none`, `select-text`, `select-all` | ✅ icons/drag handles none; prose text; code all. |
| will-change | `will-change-transform`, `will-change-auto` | 🟡 only while animating; remove after; no blanket. |

## 14. SVG

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| fill | `fill-current`, `fill-none`, `fill-chart-*` | ✅ icons `current`, stroke icons `none`, charts tokens. |
| stroke | `stroke-current`, `stroke-chart-*` | ✅ icons `current`, charts tokens. |
| stroke-width | `stroke-1`, `stroke-2` | ✅ LucideProvider sets 1.5; explicit only for custom SVG. |

## 15. Accessibility

| Property | Allowed utilities / values | Where and why |
| --- | --- | --- |
| forced-color-adjust | `forced-color-adjust-auto`, `forced-color-adjust-none` | ✅ `auto` default; `none` only for color swatches/brand where forced colors break meaning, with testing. |

## 16. Component recipes

| Pattern | Classes |
| --- | --- |
| Section card | `Card` default; `CardHeader` + `CardTitle` + `CardDescription` + `CardAction` + `CardContent` |
| Compact metric | `Card size="compact"` + direct header row + `flex flex-col` rows |
| Row list | `Card size="row"` or container + `border-t` rows |
| Page grid | `grid grid-cols-1 gap-6 lg:grid-cols-12` |
| Settings | `Card` + sections separated by `border-t pt-6` |
| Truncation | `min-w-0` on the flex child + `truncate` on the text |
| Scroll panel | `flex min-h-0 flex-1 flex-col` + `overflow-y-auto` + `scrollbar-gutter-stable` |
| Focus | `focus-visible:ring-2 focus-visible:ring-ring/80` |
| Disabled | `disabled:pointer-events-none disabled:opacity-50` |
| Skeleton | `animate-pulse` + same geometry as content |
| Empty | `place-items-center` + icon tile + title + one action |

## 17. Forbidden and rare

Forbidden in product UI:

- `float`, `clear`, `columns`, `break-*`, `box-decoration-break`, `box-content`;
- `font-stretch`, `font-feature-settings`, `text-indent`, `content-*`;
- `tracking-*` (except `tracking-normal` reset), arbitrary font sizes;
- raw palette/hex colors, arbitrary colors;
- `bg-fixed`, `bg-origin-*`, decorative gradients;
- card `shadow-*`, `text-shadow-*`;
- `mix-blend-*`, `bg-blend-*`, `mask-*`, filters, `drop-shadow-*`;
- 3D transforms, `zoom-*`, custom cursors, card `resize`;
- scroll snap outside carousels, blanket `will-change`;
- arbitrary `z-index` outside library wrappers.

Allowed only for art/landing: gradients, text shadows, masks, blend modes, filters, 3D transforms,
`zoom`, custom background images.

## 18. Decision checklist

1. Is there a component? Use it before composing utilities.
2. Is there a token? Use it before an arbitrary value.
3. Does it need to respond to container size? Use `@container`/`@min-*` before viewport variants.
4. Does it need RTL? Use logical properties.
5. Is it interactive? Add focus, disabled, loading, and a cursor.
6. Is it long content? Add `min-w-0` + `truncate`/`line-clamp` + `title`.
7. Is it a status? Use `StatusBadge`, not a colored card.
8. Is it art? Keep it inside the marketing/preview boundary and allow exceptions.
