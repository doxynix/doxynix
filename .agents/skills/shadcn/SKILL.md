---
name: shadcn
description: >
  Manage shadcn/ui components in apps/web — adding, searching, reviewing, styling and composing the
  Radix-based components installed under src/shared/ui/core. Use when editing a file in
  apps/web/src/shared/ui/core, running the shadcn CLI, checking components.json, or composing existing
  UI primitives. Bun-only repo, so the runner is always `bun x shadcn@latest`.
---

# shadcn/ui

shadcn/ui components are added to this repo as **source code**, not as a dependency. Everything lives in
`apps/web/src/shared/ui/core/`.

> **Runner:** `bun x shadcn@latest <command>`, run from `apps/web`. `bun x` requires shell approval in
> this session. Never `npx`, `pnpm dlx` or `bunx --bun` — npm/pnpm/yarn are prohibited by AGENTS.md.

## Doxynix project context

`apps/web/components.json`:

| Field | Value |
|-------|-------|
| `style` | `new-york` |
| `rsc` | `true` |
| `tsx` | `true` |
| `iconLibrary` | `lucide` (`lucide-react` 1.48.0) |
| `aliases.ui` | `@/shared/ui/core` |
| `aliases.components` | `@/shared` |
| `aliases.lib` | `@/shared/lib` |
| `aliases.utils` | `@/shared/lib/utils` |
| `aliases.hooks` | `@/shared/lib/hooks` |
| `tailwind.css` | `src/app/globals.css` |
| `tailwind.cssVariables` | `true` |
| `registries` | `@aceternity`, `@magicui` |

**Tailwind 4.3.3, CSS-first.** There is no `tailwind.config.ts` — `components.json` still names one,
but it is stale. Tokens and theme live in `src/app/globals.css` (`@import "tailwindcss"` plus an
`@theme inline` block). Never create a new CSS file or a tailwind config.

**Primitive base is Radix**, not Base UI (`sidebar.tsx` imports `@radix-ui/react-slot`). So triggers
use `asChild`, and there is no `render` prop anywhere.

### Installed components

`src/shared/ui/core/` currently contains: accordion, alert, animated-circular-progress-bar,
animated-theme-toggler, avatar, badge, breadcrumb, button, calendar, card, chart, checkbox, collapsible,
command, dialog, dropdown-menu, empty, form, input-otp, input, kbd, label, mermaid, navigation-menu,
pagination, popover, progress, resizable, scroll-area, select, separator, sheet, sidebar, skeleton,
slider, sonner, spinner, switch, table, tabs, textarea, tooltip.

Check that directory before importing anything — and before running `add`, so you do not duplicate an
existing component. **`form.tsx` is the React Hook Form variant** (`Form`, `FormField`, `FormItem`,
`FormLabel`, `FormControl`, `FormMessage`, `FormDescription`), *not* the newer `Field` /
`FieldGroup` / `InputGroup` API. Use the RHF form primitives and see the `react-hook-form` skill.

### Not installed — do not reference

`ToggleGroup`, `RadioGroup`, `Drawer`, `AlertDialog`, `ContextMenu`, `Menubar`, `HoverCard`,
`Combobox`, `InputGroup`, `Field`/`FieldGroup`, and the **chat primitives** (`MessageScroller`,
`Message`, `Bubble`, `Attachment`, `Marker`). The repo has a chat feature
(`src/features/agent/ui/agent.tsx`), but it composes plain elements — do not assume shadcn chat
components exist. Add them explicitly first if a task needs them.

`sonner.tsx` is the toast surface (Radix project), so toasts go through `toast()` from `sonner` — not
a Base UI `toast` component.

## Principles

1. **Use existing components first.** `bun x shadcn@latest search` before writing custom UI; check
   the community registries too.
2. **Compose, don't reinvent.** Dashboard = Sidebar + Card + Chart + Table.
3. **Built-in variants before custom styles.** `variant="outline"`, `size="sm"`, etc.
4. **Semantic colors only.** `bg-primary`, `text-muted-foreground` — never `bg-blue-500`.

## Critical Rules

### Styling & Tailwind → [rules/styling.md](./rules/styling.md)

- **`className` for layout, not styling.** Do not override component colors or typography.
- **No `space-x-*` / `space-y-*`.** Use `flex` + `gap-*`; vertical stacks use `flex flex-col gap-*`.
- **`size-*` when width equals height.** `size-10`, not `w-10 h-10`.
- **`truncate` shorthand**, not `overflow-hidden text-ellipsis whitespace-nowrap`.
- **No manual `dark:` overrides.** Use semantic tokens.
- **`cn()` for conditional classes** (from `@/shared/lib/utils`), not template-literal ternaries.
- **No manual `z-index`** on Dialog / Sheet / Popover.

### Component Structure → [rules/composition.md](./rules/composition.md)

- **Items always inside their Group.** `SelectItem` → `SelectGroup`,
  `DropdownMenuItem` → `DropdownMenuGroup`, `CommandItem` → `CommandGroup`.
- **`asChild` for custom triggers** (this is a Radix project). See
  [rules/base-vs-radix.md](./rules/base-vs-radix.md).
- **Dialog and Sheet always need a Title.** `DialogTitle` / `SheetTitle` for a11y; use
  `className="sr-only"` when visually hidden.
- **Full Card composition.** `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`.
- **Button has no `isPending`/`isLoading`.** Compose `Spinner` + `disabled`.
- **`TabsTrigger` only inside `TabsList`.**
- **`Avatar` always needs `AvatarFallback`.**
- **Callouts use `Alert`, empty states use `Empty`, loading uses `Skeleton`, dividers use `Separator`,
  status uses `Badge`.** Don't hand-roll styled divs.

### Icons → [rules/icons.md](./rules/icons.md)

- **Icons in `Button` use `data-icon`** (`"inline-start"` / `"inline-end"`).
- **No sizing classes on icons inside components** — CSS handles it. No `size-4`, no `w-4 h-4`.
- **Icons come from `lucide-react`** (per `iconLibrary`); swap icons from third-party registries if a
  registry item uses a different library.

### Forms

- **Use `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` from
  `form.tsx`** (RHF-based). Validation errors surface through `FormMessage`; do not hand-roll
  `aria-invalid` wiring.
- See the `react-hook-form` skill for form performance patterns.

## Key Patterns

```tsx
// Spacing: gap-*, not space-y-*.
<div className="flex flex-col gap-4">      // correct
<div className="space-y-4">                // wrong

// Equal dimensions: size-*.
<Avatar className="size-10">               // correct
<Avatar className="w-10 h-10">             // wrong

// Status: Badge variant or semantic token, not a raw color.
<Badge variant="secondary">+20.1%</Badge>     // correct
<span className="text-emerald-600">+20.1%</span> // wrong

// Icons in buttons: data-icon, no sizing classes.
<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>
```

## Workflow

1. **Check installed components** — list `src/shared/ui/core/` before importing or running `add`.
2. **Find components** — `bun x shadcn@latest search`.
3. **Get docs** — `bun x shadcn@latest docs <component>`, then fetch the returned URLs. Don't guess APIs.
4. **Install or update** — `bun x shadcn@latest add`. Preview with `--dry-run` / `--diff` first.
5. **Review what landed** — read every added file. Check for missing group wrappers, wrong imports,
   and violations of the Critical Rules above. Replace any icon imports with `lucide-react`.
6. **Third-party registries** — components from `@aceternity` / `@magicui` may hardcode
   `@/components/ui/...`. Rewrite those imports to `@/shared/ui/core/...`; the CLI only rewrites its own
   UI files.
7. **Never use `--overwrite`** without explicit approval — these files are hand-edited.

## Quick Reference

```bash
# Run from apps/web
bun x shadcn@latest info --json          # project config + installed components
bun x shadcn@latest add button card dialog
bun x shadcn@latest add @magicui/shimmer-button
bun x shadcn@latest add button --dry-run
bun x shadcn@latest add button --diff button.tsx
bun x shadcn@latest search @shadcn -q "sidebar"
bun x shadcn@latest search                # all configured registries
bun x shadcn@latest docs button dialog select
bun x shadcn@latest view @shadcn/button
```

See [cli.md](./cli.md) for the full command and flag reference.

## Detailed References

- [rules/styling.md](./rules/styling.md) — semantic colors, variants, spacing, `size-*`, `truncate`, `cn()`, z-index
- [rules/composition.md](./rules/composition.md) — groups, overlays, Card, Tabs, Avatar, Alert, Empty, Separator, Skeleton, Badge, Button loading
- [rules/icons.md](./rules/icons.md) — `data-icon`, icon sizing
- [rules/base-vs-radix.md](./rules/base-vs-radix.md) — `asChild` triggers, Radix vs Base UI APIs
- [rules/forms.md](./rules/forms.md) — form layout and validation conventions
- [cli.md](./cli.md) — commands, flags, presets, templates
- [registry.md](./registry.md) — authoring source registries, `include`, item definitions
- [customization.md](./customization.md) — theming, CSS variables, extending components