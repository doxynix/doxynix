# UI P0 Correctness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the nine correctness bugs from the UI audit whose root cause is known and whose fix does not depend on a design decision.

**Architecture:** Each fix is a small, independently testable slice. Pure logic (phrase matching, stat-key selection, better-auth error mapping, rate-limit body, forecast buckets, syntax diagnostics) is extracted into a focused module and unit-tested; the React layer only wires it up. No UI is redesigned in this phase.

**Tech Stack:** Bun, TypeScript strict, Next.js 16, React 19, tRPC 11, ZenStack/Prisma, next-intl, Radix, CodeMirror 6, Vitest 5 (`environment: node`).

**Spec:** `docs/2026-11-20-ui-audit-plan.md` (§1 P0, plus the verified browser notes in §0).

---

## Scope split

The audit spec covers five independent subsystems. This plan implements **Phase 1 only**. The remaining phases must be separate plans because they depend on product decisions:

| Phase | Scope | Blocked on |
| --- | --- | --- |
| 1 (this plan) | P0 correctness bugs | nothing |
| 2 | Dialogs/exit animation/transparency/auth form/search modal | decision: opaque vs glass |
| 3 | Card design system + 12 card migrations | decision: flat vs elevated; waves |
| 4 | Repo workspace (owner page, filters, analysis, settings, branches, lazy tree, PR draft) | decisions: multi-audit scope, branch pagination |
| 5 | Sidebar/agent, avatar, cache, dot pattern (routing — пересмотрено: не меняем) | decision: routing variant A/B |

Do not start Phase 2–5 tasks from this file.

---

## Global Constraints

- Bun only. Never `npm`, `yarn`, `pnpm`, ESLint or Prettier.
- Run `bun run format` after every code edit; Biome rewrites imports and sorts object keys.
- Run `bun run lint` (type-aware Oxlint) before every commit. No `console.log`; only `warn`/`error`/`info`.
- Comments: none unless the code is misread without it; at most two lines; no section banners.
- Branch: `fix/dxnx-<ticket>-ui-p0` (the hook only requires a `dxnx` segment). Replace `<ticket>` with the Linear issue number.
- Commit subject: `fix(web): <description>`, ≤ 72 characters, no trailing period, no ticket in the subject. `prepare-commit-msg` appends `Closes DXNX-N` from the branch name.
- Never `--no-verify`.
- Tests run through Doppler: `bun --filter @doxynix/web test <path>`. `CI=true` bypasses Doppler.
- Locales: exactly 12 files in `apps/web/messages/` (`de en es fr it ja ko pl pt-BR ru tr zh-CN`). `bun --filter @doxynix/web lint:locales` enforces identical key shape and identical placeholders across all 12.
- Never edit generated files: `apps/web/prisma/schema.prisma`, `apps/web/messages/en.d.json.ts`, `packages/shared/src/enums/index.ts`.
- next-intl rewrites `apps/web/messages/en.d.json.ts` during `bun run dev` / `bun run build`. After adding message keys, start `bun run dev`, wait for `Ready`, stop it, then run `bun run type-check`; otherwise TypeScript does not see the new keys.
- Import boundaries: `apps/web/src/{app,entities,features,widgets,shared}` flow downward only; no cross-slice imports. Helpers used by one slice live in that slice's `model/`.

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `apps/web/src/features/repo-docs-viewer/model/floating-card-stats.ts` | Stat keys rendered by the docs hover card |
| `apps/web/src/features/repo-docs-viewer/model/floating-card-stats.test.ts` | Key selection, `pathCount`/unknown-key exclusion |
| `apps/web/src/shared/lib/two-factor-error.ts` | better-auth code/message → translation key |
| `apps/web/src/shared/lib/two-factor-error.test.ts` | Mapping contract |
| `apps/web/src/shared/i18n/use-two-factor-error-message.ts` | Hook over the mapper |
| `apps/web/src/entities/repo/model/editor-extensions.test.ts` | Syntax diagnostics contract |

**Modified**

| File | Change |
| --- | --- |
| `apps/web/src/shared/ui/kit/confirmation-field.tsx` | Inline the exact matcher |
| `apps/web/src/shared/ui/kit/danger-action-dialog.tsx` | Import the matcher from `confirmation-field` |
| `apps/web/src/features/settings/ui/api-keys/rotate-api-key-dialog.tsx` | Readable warning alert |
| `apps/web/src/entities/api-key/ui/api-key-card.tsx` | Readable grace line |
| `apps/web/src/server/modules/users/user.mapper.ts` | Email fallback for legacy accounts |
| `apps/web/src/server/modules/users/user.service.ts` | Pass the user email as fallback |
| `apps/web/src/server/modules/users/user.mapper.test.ts` | Fallback tests |
| `apps/web/messages/*.json` (12) | `{identity}`, `stats_configs`, three 2FA error keys |
| `apps/web/src/entities/audit-log/ui/audit-log-sheet.tsx` | Hover/focus on the whole button |
| `apps/web/src/features/admin/ui/admin-audit-table.tsx` | Same |
| `apps/web/src/features/repo-docs-viewer/ui/repo-floating-card.tsx` | Typed stat map + guard |
| `apps/web/src/features/settings/ui/connections/two-factor-card.tsx` | Preserve better-auth errors |
| `apps/web/src/features/auth/model/use-two-factor-verification.ts` | Preserve errors, localized message |
| `apps/web/src/shared/lib/proxy-routing.ts` | `buildRateLimitBody` |
| `apps/web/src/shared/lib/proxy-routing.test.ts` | Envelope tests |
| `apps/web/src/proxy.ts` | Return the tRPC-shaped 429 |
| `apps/web/src/shared/i18n/use-error-message.ts` | Stable callback identity |
| `apps/web/src/widgets/welcome-flow/model/use-github-install.ts` | Use the shared error message |
| `apps/web/src/widgets/welcome-flow/model/use-welcome-flow.ts` | Use the shared error message |
| `apps/web/src/features/manage-subscription/model/usage-forecast.ts` | No forecast point for today |
| `apps/web/src/features/manage-subscription/model/usage-forecast.test.ts` | Regression test |
| `apps/web/src/entities/repo/model/editor-extensions.ts` | Extract diagnostics + lint toggle |
| `apps/web/src/entities/repo/ui/repo-code-editor.tsx` | Lint after language load, refresh count, reset per file |
| `apps/web/src/features/repo-code-viewer/ui/repo-code-container.tsx` | Pass the selected branch |

---

## Task 0: Branch and baseline

**Files:** none.

**Interfaces:**
- Consumes: nothing.
- Produces: a clean branch where every later command runs.

- [ ] **Step 1: Create the branch**

```bash
git switch main
git pull
git switch -c fix/dxnx-123-ui-p0
```

Expected: `Switched to a new branch 'fix/dxnx-123-ui-p0'`. Replace `123` with the Linear ticket before running.

- [ ] **Step 2: Prove the test runner works**

```bash
bun --filter @doxynix/web test src/shared/i18n/use-error-message.test.ts
```

Expected: `Test Files  1 passed`, `Tests  8 passed` (the exact count may differ; the run must exit 0).

- [ ] **Step 3: Confirm the working tree is clean**

```bash
git status --short
```

Expected: only the pre-existing `bun.lock` modification, or empty.

---

## Task 1: Exact destructive confirmation phrase

**Files:**
- Modify: `apps/web/src/shared/ui/kit/confirmation-field.tsx:1-14`
- Modify: `apps/web/src/shared/ui/kit/danger-action-dialog.tsx:21`

**Interfaces:**
- Consumes: nothing.
- Produces: `phraseMatches(value: string, phrase: string): boolean`, exported from `@/shared/ui/kit/confirmation-field`.

Do not create a separate module or a test file: the comparison is one line, and the product decision is to keep it inline.

- [ ] **Step 1: Inline the exact matcher**

In `apps/web/src/shared/ui/kit/confirmation-field.tsx`, add the function after the imports:

```ts
export function phraseMatches(value: string, phrase: string): boolean {
  return value.trim() === phrase.trim();
}
```

The previous implementation lowercased both sides, which let `delete` arm a `DELETE` confirmation. Keep the export: `danger-action-dialog.tsx` consumes it.

- [ ] **Step 2: Restore the dialog import**

In `apps/web/src/shared/ui/kit/danger-action-dialog.tsx`, set line 21 to:

```ts
import { ConfirmationField, phraseMatches } from "./confirmation-field";
```

Delete any import from `./confirmation-phrase` and delete `confirmation-phrase.ts` / `confirmation-phrase.test.ts` if they exist.

- [ ] **Step 3: Verify importers**

```bash
grep -rn "phraseMatches" apps/web/src
```

Expected: `confirmation-field.tsx` (definition) and `danger-action-dialog.tsx` (import + usage) only.

- [ ] **Step 4: Format and commit**

```bash
bun run format
git add apps/web/src/shared/ui/kit/confirmation-field.tsx apps/web/src/shared/ui/kit/danger-action-dialog.tsx
git commit -m "fix(web): require exact destructive confirmation phrase"
```

Expected: commit succeeds; pre-commit passes.

---

## Task 2: Readable warning text on tinted surfaces

**Files:**
- Modify: `apps/web/src/features/settings/ui/api-keys/rotate-api-key-dialog.tsx:93-98`
- Modify: `apps/web/src/entities/api-key/ui/api-key-card.tsx:59`

**Interfaces:**
- Consumes: the existing `Alert`/`AlertTitle`/`AlertDescription` primitives.
- Produces: no API change; only class strings.

- [ ] **Step 1: Record the broken state**

```bash
grep -rn "warning-foreground" apps/web/src/features/settings/ui/api-keys apps/web/src/entities/api-key
```

Expected: two matches (`rotate-api-key-dialog.tsx`, `api-key-card.tsx`).

- [ ] **Step 2: Fix the rotate dialog**

In `apps/web/src/features/settings/ui/api-keys/rotate-api-key-dialog.tsx`, replace the `Alert` block (lines 93-98) with:

```tsx
<Alert className="border-warning/20 bg-warning/10">
  <AlertTitle className="font-semibold text-foreground">
    {t("settings_api_keys_rotate_note_title")}
  </AlertTitle>
  <AlertDescription>{t("settings_api_keys_rotate_note")}</AlertDescription>
</Alert>
```

`AlertDescription` already applies `text-muted-foreground`; do not add a colour class to it.

- [ ] **Step 3: Fix the key card grace line**

In `apps/web/src/entities/api-key/ui/api-key-card.tsx`, replace line 59 with:

```tsx
<p className="text-warning">
```

- [ ] **Step 4: Verify the token is gone**

```bash
grep -rn "warning-foreground" apps/web/src/features/settings/ui/api-keys apps/web/src/entities/api-key
```

Expected: no output, exit code 1.

- [ ] **Step 5: Manual verification**

```bash
bun run dev
```

Open `http://localhost:3000/ru/dashboard/settings/api-keys` in dark theme, create a key, then open the rotate dialog. Expected: the title «Сначала скопируйте новый ключ» is white/foreground, the body is muted, the amber border/tint remains. Revoke a key with a grace period and confirm «Ротирован — действует до» is amber, not black. Stop the dev server with `Ctrl+C`.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add apps/web/src/features/settings/ui/api-keys/rotate-api-key-dialog.tsx apps/web/src/entities/api-key/ui/api-key-card.tsx
git commit -m "fix(web): use readable warning text on tinted surfaces"
```

---

## Task 3: Restore the connected account email

**Files:**
- Modify: all 12 `apps/web/messages/<locale>.json` at `settings_auth_connected_as`
- Modify: `apps/web/src/server/modules/users/user.mapper.ts:94-102`
- Modify: `apps/web/src/server/modules/users/user.service.ts:232`
- Modify: `apps/web/src/server/modules/users/user.mapper.test.ts` (append)

**Interfaces:**
- Consumes: `LinkedAccountRecord` (Prisma payload with nullable `email`).
- Produces: `userMapper.toLinkedAccount(account: LinkedAccountRecord, fallbackEmail?: string | null)`; the returned `email` is `string | null`.

- [ ] **Step 1: Write the failing mapper test**

Append to `apps/web/src/server/modules/users/user.mapper.test.ts`:

```ts
type LinkedAccountRecord = Parameters<typeof userMapper.toLinkedAccount>[0];

function makeLinkedAccount(overrides?: Partial<LinkedAccountRecord>): LinkedAccountRecord {
  return {
    accountId: "123456",
    email: "octocat@github.example",
    image: null,
    name: "octocat",
    providerId: "github",
    ...overrides,
  } as LinkedAccountRecord;
}

describe("userMapper.toLinkedAccount", () => {
  it("keeps the provider email when present", () => {
    expect(userMapper.toLinkedAccount(makeLinkedAccount()).email).toBe("octocat@github.example");
  });

  it("falls back to the user's email for legacy rows without one", () => {
    expect(userMapper.toLinkedAccount(makeLinkedAccount({ email: null }), "user@example.com").email).toBe(
      "user@example.com",
    );
  });

  it("returns null when neither email exists", () => {
    expect(userMapper.toLinkedAccount(makeLinkedAccount({ email: null }), null).email).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --filter @doxynix/web test src/server/modules/users/user.mapper.test.ts
```

Expected: FAIL — `toLinkedAccount` accepts 1 argument, so the second argument is a TypeScript error, and the null-email case returns `null` instead of the fallback.

- [ ] **Step 3: Implement the fallback**

In `apps/web/src/server/modules/users/user.mapper.ts`, replace `toLinkedAccount` (lines 94-102) with:

```ts
  toLinkedAccount(account: LinkedAccountRecord, fallbackEmail?: string | null) {
    return {
      accountId: account.accountId,
      email: account.email ?? fallbackEmail ?? null,
      image: account.image,
      name: account.name,
      provider: account.providerId,
    };
  },
```

- [ ] **Step 4: Pass the fallback from the service**

In `apps/web/src/server/modules/users/user.service.ts`, replace line 232:

```ts
    const mappedAccounts = accounts.map((acc) =>
      userMapper.toLinkedAccount(acc, user?.email),
    );
```

- [ ] **Step 5: Run the mapper test**

```bash
bun --filter @doxynix/web test src/server/modules/users/user.mapper.test.ts
```

Expected: all tests pass, including the three new ones.

- [ ] **Step 6: Add the placeholder to all 12 locales**

In each `apps/web/messages/<locale>.json`, replace the `settings_auth_connected_as` value with the row below (keep the surrounding JSON structure and the same line position):

| File | Value |
| --- | --- |
| `de.json` | `"Verbunden als {identity}"` |
| `en.json` | `"Connected as {identity}"` |
| `es.json` | `"Conectado como {identity}"` |
| `fr.json` | `"Connecté en tant que {identity}"` |
| `it.json` | `"Connesso come {identity}"` |
| `ja.json` | `"接続アカウント {identity}"` |
| `ko.json` | `"다음으로 연결됨: {identity}"` |
| `pl.json` | `"Połączono jako {identity}"` |
| `pt-BR.json` | `"Conectado como {identity}"` |
| `ru.json` | `"Подключено как {identity}"` |
| `tr.json` | `"Bağlanılan hesap: {identity}"` |
| `zh-CN.json` | `"已连接为 {identity}"` |

- [ ] **Step 7: Verify locale shape and placeholders**

```bash
bun --filter @doxynix/web lint:locales
```

Expected: exit code 0. If a locale is missing `{identity}`, the script prints the file and key.

- [ ] **Step 8: Manual verification**

Run `bun run dev`, open `http://localhost:3000/ru/dashboard/settings/connections`. Expected: the GitHub card reads «Подключено как karen.avakov2…» or the account email, not a bare «Подключено как». Stop the server.

- [ ] **Step 9: Format and commit**

```bash
bun run format
git add apps/web/messages apps/web/src/server/modules/users/user.mapper.ts apps/web/src/server/modules/users/user.service.ts apps/web/src/server/modules/users/user.mapper.test.ts
git commit -m "fix(web): restore the connected account email"
```

---

## Task 4: Audit-log view button lights up across its hit area

**Files:**
- Modify: `apps/web/src/entities/audit-log/ui/audit-log-sheet.tsx:57-72`
- Modify: `apps/web/src/features/admin/ui/admin-audit-table.tsx:157-166`

**Interfaces:**
- Consumes: `AppButton variant="ghost"` and the row's `group` class.
- Produces: no API change.

- [ ] **Step 1: Record the broken state**

```bash
grep -rn "text-muted-foreground hover:text-foreground" apps/web/src/entities/audit-log apps/web/src/features/admin
```

Expected: two matches, both on the icon element.

- [ ] **Step 2: Patch the user audit sheet**

In `apps/web/src/entities/audit-log/ui/audit-log-sheet.tsx`, replace the button and icon (lines 59-65) with:

```tsx
          <AppButton
            aria-label={t("view_raw")}
            className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
            size="icon"
            variant="ghost"
          >
            <Eye />
          </AppButton>
```

- [ ] **Step 3: Patch the admin audit table**

In `apps/web/src/features/admin/ui/admin-audit-table.tsx`, replace the button and icon (lines 159-165) with:

```tsx
        <AppButton
          aria-label={t("detail_title")}
          className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
          size="icon"
          variant="ghost"
        >
          <Database />
        </AppButton>
```

- [ ] **Step 4: Verify the icon classes are gone**

```bash
grep -rn "text-muted-foreground hover:text-foreground" apps/web/src/entities/audit-log apps/web/src/features/admin
```

Expected: no output.

- [ ] **Step 5: Manual verification**

Run `bun run dev`, open the user audit log and the admin audit table. Expected: hovering anywhere in the 36×36 button area lights the icon; tabbing to it shows it (`focus-visible:opacity-100`); hovering the 8px table-cell padding no longer leaves it muted. Stop the server.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add apps/web/src/entities/audit-log/ui/audit-log-sheet.tsx apps/web/src/features/admin/ui/admin-audit-table.tsx
git commit -m "fix(web): light up the audit-log view button on hover"
```

---

## Task 5: Stop the docs hover card crashing on config stats

**Files:**
- Create: `apps/web/src/features/repo-docs-viewer/model/floating-card-stats.ts`
- Create: `apps/web/src/features/repo-docs-viewer/model/floating-card-stats.test.ts`
- Modify: `apps/web/src/features/repo-docs-viewer/ui/repo-floating-card.tsx:73-84, 138-154, 220-239, 251-279`
- Modify: all 12 `apps/web/messages/<locale>.json` (add `stats_configs`)

**Interfaces:**
- Consumes: `StructureNodeStats` from the tRPC payload (all numeric keys, including `configCount` and `pathCount`).
- Produces: `FLOATING_CARD_STAT_KEYS`, `FloatingCardStatKey`, `activeStatKeys(stats: Record<string, number>): FloatingCardStatKey[]`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/repo-docs-viewer/model/floating-card-stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  activeStatKeys,
  FLOATING_CARD_STAT_KEYS,
} from "./floating-card-stats";

const ZERO_STATS = Object.fromEntries(
  FLOATING_CARD_STAT_KEYS.map((key) => [key, 0]),
) as Record<string, number>;

describe("activeStatKeys", () => {
  it("includes configCount, which used to crash the card", () => {
    expect(activeStatKeys({ ...ZERO_STATS, configCount: 2 })).toEqual(["configCount"]);
  });

  it("drops zero values", () => {
    expect(activeStatKeys(ZERO_STATS)).toEqual([]);
  });

  it("drops pathCount and unknown server keys instead of throwing", () => {
    const stats = { ...ZERO_STATS, pathCount: 9, madeUpCount: 4 } as Record<string, number>;

    expect(activeStatKeys(stats)).toEqual([]);
  });

  it("returns keys in the declared order, independent of the payload order", () => {
    const stats = {
      ...ZERO_STATS,
      apiCount: 1,
      configCount: 1,
    } as Record<string, number>;

    expect(activeStatKeys(stats)).toEqual(["apiCount", "configCount"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --filter @doxynix/web test src/features/repo-docs-viewer/model/floating-card-stats.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the model**

Create `apps/web/src/features/repo-docs-viewer/model/floating-card-stats.ts`:

```ts
export const FLOATING_CARD_STAT_KEYS = [
  "apiCount",
  "changeCouplingCount",
  "churnCount",
  "configCount",
  "dependencyHotspotCount",
  "entrypointCount",
  "frameworkCount",
  "graphWarningCount",
  "hotspotCount",
  "orphanCount",
  "riskCount",
] as const;

export type FloatingCardStatKey = (typeof FLOATING_CARD_STAT_KEYS)[number];

export function activeStatKeys(stats: Record<string, number>): FloatingCardStatKey[] {
  return FLOATING_CARD_STAT_KEYS.filter((key) => {
    const value = stats[key];
    return typeof value === "number" && value > 0;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun --filter @doxynix/web test src/features/repo-docs-viewer/model/floating-card-stats.test.ts
```

Expected: `Tests  4 passed`.

- [ ] **Step 5: Replace the unchecked map in the UI**

In `apps/web/src/features/repo-docs-viewer/ui/repo-floating-card.tsx`:

Add to the imports:

```tsx
import type { LucideIcon } from "lucide-react";

import {
  activeStatKeys,
  type FloatingCardStatKey,
} from "../../model/floating-card-stats";
```

Replace the `STATS_CONFIG` declaration (lines 73-84) with:

```tsx
const STATS_CONFIG = {
  apiCount: { icon: Unplug, statKey: "stats_api_routes" },
  changeCouplingCount: { icon: RefreshCw, statKey: "stats_couplings" },
  churnCount: { icon: GitBranch, statKey: "stats_churns" },
  configCount: { icon: FileCog, statKey: "stats_configs" },
  dependencyHotspotCount: { icon: Network, statKey: "stats_centrality" },
  entrypointCount: { icon: PlayCircle, statKey: "stats_entrypoints" },
  frameworkCount: { icon: Cpu, statKey: "stats_frameworks" },
  graphWarningCount: { icon: AlertCircle, statKey: "stats_unresolved" },
  hotspotCount: { icon: Flame, statKey: "stats_hotspots" },
  orphanCount: { icon: Link2Off, statKey: "stats_orphan" },
  riskCount: { icon: ShieldAlert, isDestructive: true, statKey: "stats_vulnerabilities" },
} as const satisfies Record<
  FloatingCardStatKey,
  { icon: LucideIcon; isDestructive?: boolean; statKey: keyof IntlMessages["Dashboard"] }
>;
```

Add `FileCog` to the existing `lucide-react` import list.

- [ ] **Step 6: Use the typed selector**

Replace `activeMarkers` (lines 138-143) with:

```tsx
  const activeMarkers =
    node != null
      ? Object.entries(node.markers)
          .filter(([, isActive]) => isActive)
          .flatMap(([key]) =>
            key in MARKERS_CONFIG ? [key as keyof typeof MARKERS_CONFIG] : [],
          )
      : [];
```

Replace `activeStats` (lines 145-154) with:

```tsx
  const activeStats =
    node != null
      ? activeStatKeys(node.stats).map((key) => ({
          config: STATS_CONFIG[key],
          key,
          value: node.stats[key],
        }))
      : [];
```

The render block at lines 251-279 stays unchanged: `config` is now guaranteed to exist for every selected key.

- [ ] **Step 7: Add the missing translation**

Insert `stats_configs` next to the other `stats_*` keys inside `"Dashboard"` (alphabetically after `stats_churns` in `apps/web/messages/en.json:1442`):

| File | Value |
| --- | --- |
| `de.json` | `"Konfigurationen"` |
| `en.json` | `"Configs"` |
| `es.json` | `"Configuraciones"` |
| `fr.json` | `"Configurations"` |
| `it.json` | `"Configurazioni"` |
| `ja.json` | `"設定"` |
| `ko.json` | `"구성"` |
| `pl.json` | `"Konfiguracje"` |
| `pt-BR.json` | `"Configurações"` |
| `ru.json` | `"Конфиги"` |
| `tr.json` | `"Yapılandırmalar"` |
| `zh-CN.json` | `"配置"` |

- [ ] **Step 8: Regenerate message types, then verify**

```bash
bun run dev
```

Wait for `Ready` in the Turborepo TUI, then press `Ctrl+C`. This rewrites `apps/web/messages/en.d.json.ts` with `stats_configs`.

```bash
bun --filter @doxynix/web lint:locales
bun run type-check
```

Expected: both exit 0. If a stat key is missing from `STATS_CONFIG`, TypeScript fails on the `satisfies Record<FloatingCardStatKey, …>`.

- [ ] **Step 9: Manual verification**

Run `bun run dev`, open a repo with a completed analysis → «Документация». Hover a config file such as `package.json` or `tsconfig.json`. Expected: the card opens and lists «Конфиги», no console error. Stop the server.

- [ ] **Step 10: Format and commit**

```bash
bun run format
git add apps/web/src/features/repo-docs-viewer/model/floating-card-stats.ts apps/web/src/features/repo-docs-viewer/model/floating-card-stats.test.ts apps/web/src/features/repo-docs-viewer/ui/repo-floating-card.tsx apps/web/messages
git commit -m "fix(web): stop the docs card crashing on config stats"
```

---

## Task 6: Specific two-factor verification errors

**Files:**
- Create: `apps/web/src/shared/lib/two-factor-error.ts`
- Create: `apps/web/src/shared/lib/two-factor-error.test.ts`
- Create: `apps/web/src/shared/i18n/use-two-factor-error-message.ts`
- Modify: `apps/web/src/features/auth/model/use-two-factor-verification.ts:33-62`
- Modify: `apps/web/src/features/settings/ui/connections/two-factor-card.tsx:55-110`
- Modify: all 12 `apps/web/messages/<locale>.json` (three `Errors` keys)

**Interfaces:**
- Consumes: better-auth client errors `{ code?: string; message?: string }`.
- Produces: `twoFactorErrorKey(error: unknown): TwoFactorErrorKey | null`, `type TwoFactorErrorKey = "two_factor_invalid_code" | "two_factor_rate_limited" | "two_factor_unavailable"`, `useTwoFactorErrorMessage(): (error: unknown) => string | null`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/shared/lib/two-factor-error.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { twoFactorErrorKey } from "./two-factor-error";

describe("twoFactorErrorKey", () => {
  it("maps a better-auth code", () => {
    expect(twoFactorErrorKey({ code: "INVALID_CODE" })).toBe("two_factor_invalid_code");
  });

  it("maps an invalid backup code to the same message", () => {
    expect(twoFactorErrorKey({ code: "INVALID_BACKUP_CODE" })).toBe("two_factor_invalid_code");
  });

  it("maps rate limiting", () => {
    expect(twoFactorErrorKey({ code: "ACCOUNT_TEMPORARILY_LOCKED" })).toBe(
      "two_factor_rate_limited",
    );
  });

  it("maps configuration problems to unavailable", () => {
    expect(twoFactorErrorKey({ code: "TOTP_NOT_ENABLED" })).toBe("two_factor_unavailable");
  });

  it("falls back to the message when the code is missing", () => {
    expect(twoFactorErrorKey({ message: "Invalid code" })).toBe("two_factor_invalid_code");
    expect(twoFactorErrorKey({ message: "TOTP not enabled" })).toBe("two_factor_unavailable");
  });

  it("returns null for an unknown error", () => {
    expect(twoFactorErrorKey(new Error("boom"))).toBeNull();
    expect(twoFactorErrorKey(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --filter @doxynix/web test src/shared/lib/two-factor-error.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the mapper**

Create `apps/web/src/shared/lib/two-factor-error.ts`:

```ts
export type TwoFactorErrorKey =
  | "two_factor_invalid_code"
  | "two_factor_rate_limited"
  | "two_factor_unavailable";

type Entry = {
  code: string;
  key: TwoFactorErrorKey;
  message: string;
};

const ENTRIES: readonly Entry[] = [
  { code: "ACCOUNT_TEMPORARILY_LOCKED", key: "two_factor_rate_limited", message: "Too many failed verification attempts. Your account is temporarily locked. Please try again later." },
  { code: "BACKUP_CODES_NOT_ENABLED", key: "two_factor_unavailable", message: "Backup codes aren't enabled" },
  { code: "INVALID_BACKUP_CODE", key: "two_factor_invalid_code", message: "Invalid backup code" },
  { code: "INVALID_CODE", key: "two_factor_invalid_code", message: "Invalid code" },
  { code: "INVALID_TWO_FACTOR_COOKIE", key: "two_factor_unavailable", message: "Invalid two factor cookie" },
  { code: "OTP_HAS_EXPIRED", key: "two_factor_invalid_code", message: "OTP has expired" },
  { code: "OTP_NOT_CONFIGURED", key: "two_factor_unavailable", message: "OTP is not available" },
  { code: "OTP_NOT_ENABLED", key: "two_factor_unavailable", message: "OTP not enabled" },
  { code: "TOTP_NOT_CONFIGURED", key: "two_factor_unavailable", message: "TOTP is not available" },
  { code: "TOTP_NOT_ENABLED", key: "two_factor_unavailable", message: "TOTP not enabled" },
  { code: "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE", key: "two_factor_rate_limited", message: "Too many attempts. Please request a new code." },
  { code: "TWO_FACTOR_NOT_ENABLED", key: "two_factor_unavailable", message: "Two factor isn't enabled" },
];

const BY_CODE = new Map(ENTRIES.map((entry) => [entry.code, entry.key]));
const BY_MESSAGE = new Map(ENTRIES.map((entry) => [entry.message, entry.key]));

export function twoFactorErrorKey(error: unknown): TwoFactorErrorKey | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const { code, message } = error as { code?: unknown; message?: unknown };

  if (typeof code === "string") {
    const byCode = BY_CODE.get(code);
    if (byCode != null) {
      return byCode;
    }
  }

  if (typeof message === "string") {
    return BY_MESSAGE.get(message) ?? null;
  }

  return null;
}
```

Sort the `ENTRIES` array alphabetically by `code` as shown; Biome does not sort array elements, the order is for reviewers.

- [ ] **Step 4: Run the mapper test**

```bash
bun --filter @doxynix/web test src/shared/lib/two-factor-error.test.ts
```

Expected: `Tests  6 passed`.

- [ ] **Step 5: Add the hook**

Create `apps/web/src/shared/i18n/use-two-factor-error-message.ts`:

```ts
"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { type TwoFactorErrorKey, twoFactorErrorKey } from "@/shared/lib/two-factor-error";

export function useTwoFactorErrorMessage() {
  const t = useTranslations("Errors");

  return useCallback(
    (error: unknown): string | null => {
      const key: TwoFactorErrorKey | null = twoFactorErrorKey(error);
      return key == null ? null : t(key);
    },
    [t],
  );
}
```

- [ ] **Step 6: Preserve the original error and use the mapper**

In `apps/web/src/features/auth/model/use-two-factor-verification.ts`:

Add the import and hook:

```ts
import { useTwoFactorErrorMessage } from "@/shared/i18n/use-two-factor-error-message";
```

Inside the hook body, next to the other hooks:

```ts
  const twoFactorMessage = useTwoFactorErrorMessage();
```

Replace the two `throw new Error(error.message)` occurrences (lines 36 and 43) with:

```ts
            throw error;
```

In the `.catch` (lines 57-60), replace the message selection with:

```ts
      .catch((error: unknown) => {
        toast.error(twoFactorMessage(error) ?? t("error_verification_failed"));
```

Close the callback with the existing `});` without changing the router logic.

In `apps/web/src/features/settings/ui/connections/two-factor-card.tsx`:

Add the import:

```ts
import { useTwoFactorErrorMessage } from "@/shared/i18n/use-two-factor-error-message";
```

Inside the component:

```ts
  const twoFactorMessage = useTwoFactorErrorMessage();
```

Replace every `throw new Error(res.error.message)`, `throw new Error(totpRes.error.message)`, and `throw new Error(error.message)` (lines 59, 69, 89, 107) with `throw res.error`, `throw totpRes.error`, `throw error` respectively.

Replace every `toast.error(errorMessage(error))` / `toast.error(errorMessage(err))` in this file with:

```ts
        toast.error(twoFactorMessage(error) ?? errorMessage(error));
```

Use the same expression in `onError` callbacks, naming the parameter as it already is (`err` → `twoFactorMessage(err) ?? errorMessage(err)`).

- [ ] **Step 7: Add the translations**

In each `apps/web/messages/<locale>.json`, add these three keys inside `"Errors"` (the exact position does not matter; keep valid JSON and the same nesting):

| File | `two_factor_invalid_code` | `two_factor_rate_limited` | `two_factor_unavailable` |
| --- | --- | --- | --- |
| `de.json` | `Der Bestätigungscode ist ungültig.` | `Zu viele Versuche. Versuchen Sie es später erneut.` | `Zwei-Faktor-Authentifizierung ist nicht verfügbar. Aktualisieren Sie die Seite und versuchen Sie es erneut.` |
| `en.json` | `That verification code is not valid.` | `Too many attempts. Try again later.` | `Two-factor authentication is not available. Refresh the page and try again.` |
| `es.json` | `El código de verificación no es válido.` | `Demasiados intentos. Inténtalo de nuevo más tarde.` | `La autenticación de dos factores no está disponible. Actualiza la página e inténtalo de nuevo.` |
| `fr.json` | `Le code de vérification n'est pas valide.` | `Trop de tentatives. Réessayez plus tard.` | `L'authentification à deux facteurs n'est pas disponible. Actualisez la page et réessayez.` |
| `it.json` | `Il codice di verifica non è valido.` | `Troppi tentativi. Riprova più tardi.` | `L'autenticazione a due fattori non è disponibile. Aggiorna la pagina e riprova.` |
| `ja.json` | `確認コードが正しくありません。` | `試行回数が多すぎます。後でもう一度お試しください。` | `二段階認証を利用できません。ページを更新してもう一度お試しください。` |
| `ko.json` | `확인 코드가 올바르지 않습니다.` | `시도 횟수가 너무 많습니다. 나중에 다시 시도하세요.` | `2단계 인증을 사용할 수 없습니다. 페이지를 새로고침한 후 다시 시도하세요.` |
| `pl.json` | `Kod weryfikacyjny jest nieprawidłowy.` | `Zbyt wiele prób. Spróbuj ponownie później.` | `Uwierzytelnianie dwuskładnikowe jest niedostępne. Odśwież stronę i spróbuj ponownie.` |
| `pt-BR.json` | `O código de verificação não é válido.` | `Muitas tentativas. Tente novamente mais tarde.` | `A autenticação de dois fatores não está disponível. Atualize a página e tente novamente.` |
| `ru.json` | `Неверный код подтверждения.` | `Слишком много попыток. Повторите позже.` | `Двухфакторная аутентификация недоступна. Обновите страницу и попробуйте снова.` |
| `tr.json` | `Doğrulama kodu geçersiz.` | `Çok fazla deneme. Daha sonra tekrar deneyin.` | `İki adımlı doğrulama kullanılamıyor. Sayfayı yenileyip tekrar deneyin.` |
| `zh-CN.json` | `验证码无效。` | `尝试次数过多。请稍后再试。` | `双重验证不可用。请刷新页面后重试。` |

- [ ] **Step 8: Regenerate message types, then verify**

```bash
bun run dev
```

Wait for `Ready`, then press `Ctrl+C`. This rewrites `apps/web/messages/en.d.json.ts` with the three `Errors` keys.

```bash
bun --filter @doxynix/web lint:locales
bun run type-check
```

Expected: both exit 0. `t(key)` must accept `TwoFactorErrorKey`; if it does not, the key is missing from at least one locale.

- [ ] **Step 9: Manual verification**

Run `bun run dev`, open «Настройки → Подключения → Двухфакторная аутентификация → Настройка», enter `000000`, submit. Expected: «Неверный код подтверждения.», not «Что-то пошло не так». Stop the server.

- [ ] **Step 10: Format and commit**

```bash
bun run format
git add apps/web/src/shared/lib/two-factor-error.ts apps/web/src/shared/lib/two-factor-error.test.ts apps/web/src/shared/i18n/use-two-factor-error-message.ts apps/web/src/features/auth/model/use-two-factor-verification.ts apps/web/src/features/settings/ui/connections/two-factor-card.tsx apps/web/messages
git commit -m "fix(web): show specific two-factor verification errors"
```

---

## Task 7: Rate limits surface as rate limits

**Files:**
- Modify: `apps/web/src/shared/lib/proxy-routing.ts`
- Modify: `apps/web/src/shared/lib/proxy-routing.test.ts`
- Modify: `apps/web/src/proxy.ts:34-74, 95`
- Modify: `apps/web/src/shared/i18n/use-error-message.ts:186-202`
- Modify: `apps/web/src/widgets/welcome-flow/model/use-github-install.ts`
- Modify: `apps/web/src/widgets/welcome-flow/model/use-welcome-flow.ts:83-88`

**Interfaces:**
- Consumes: `MessageCode.MEMBER_RATE_LIMITED` (already public for `TOO_MANY_REQUESTS`).
- Produces: `buildRateLimitBody(pathname: string, requestId: string): Record<string, unknown>`.

- [ ] **Step 1: Write the failing test**

Append the new `describe` block to `apps/web/src/shared/lib/proxy-routing.test.ts` and extend the existing `@/shared/lib/proxy-routing` import so it contains `buildRateLimitBody`. The top of the file becomes:

```ts
import { describe, expect, it } from "vitest";

import { API_PREFIX } from "@/shared/config/env.client";
import { DEFAULT_LOCALE } from "@/shared/config/locales";
import { readErrorPayload } from "@/shared/i18n/use-error-message";
import {
  buildRateLimitBody,
  hasPathBoundary,
  isBypassRoute,
  resolveDocsPath,
  resolvePageRedirect,
} from "@/shared/lib/proxy-routing";
```

Then append:

```ts
describe("shared/lib/middleware-routing:buildRateLimitBody", () => {
  it("returns a tRPC envelope with a public message code for /trpc", () => {
    const body = buildRateLimitBody("/api/trpc/repo.getAll", "req-1") as {
      error: { json: Record<string, unknown> };
    };

    expect(body.error.json).toMatchObject({
      code: -32029,
      data: { httpStatus: 429, messageCode: "MEMBER_RATE_LIMITED" },
      message: "You're sending requests too often. Please wait.",
    });
    expect(readErrorPayload(body.error.json).messageCode).toBe("MEMBER_RATE_LIMITED");
  });

  it("keeps a plain JSON error for non-tRPC routes", () => {
    expect(buildRateLimitBody("/api/webhooks/github", "req-1")).toEqual({
      error: "Too Many Requests",
      message: "You're sending requests too often. Please wait.",
    });
  });

  it("also recognizes the legacy /trpc prefix", () => {
    expect(buildRateLimitBody("/trpc/repo.getAll", "req-1")).toHaveProperty("error.json");
  });
});
```

Do not add a second import statement from `@/shared/lib/proxy-routing`.

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --filter @doxynix/web test src/shared/lib/proxy-routing.test.ts
```

Expected: FAIL — `buildRateLimitBody` is not exported.

- [ ] **Step 3: Implement the body builder**

Append to `apps/web/src/shared/lib/proxy-routing.ts`:

```ts
const TRPC_TOO_MANY_REQUESTS = -32029;

export function buildRateLimitBody(
  pathname: string,
  requestId: string,
): Record<string, unknown> {
  const message = "You're sending requests too often. Please wait.";

  if (!pathname.startsWith("/trpc") && !pathname.startsWith("/api/trpc")) {
    return { error: "Too Many Requests", message };
  }

  return {
    error: {
      json: {
        code: TRPC_TOO_MANY_REQUESTS,
        data: {
          code: "TOO_MANY_REQUESTS",
          httpStatus: 429,
          kind: "trpc",
          messageCode: "MEMBER_RATE_LIMITED",
          params: null,
          requestId,
          zodError: null,
        },
        message,
      },
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun --filter @doxynix/web test src/shared/lib/proxy-routing.test.ts
```

Expected: all existing tests plus `Tests  2 passed` for the new describe.

- [ ] **Step 5: Return the body from the proxy**

In `apps/web/src/proxy.ts`:

Change the signature and body of `handleRateLimitAndSize` (lines 34-74) to:

```ts
async function handleRateLimitAndSize(
  request: NextRequest,
  pathname: string,
  ip: string,
  requestId: string,
): Promise<NextResponse | null> {
  if (isBypassRoute(pathname)) {
    return null;
  }

  if (ratelimit != null) {
    const token = request.cookies.get(cookieName)?.value;
    const identifier =
      token != null ? REDIS_CONFIG.rateLimit.userToken(token) : REDIS_CONFIG.rateLimit.ip(ip);

    try {
      const { limit, remaining, reset, success } = await ratelimit.limit(identifier);

      if (!success) {
        return new NextResponse(JSON.stringify(buildRateLimitBody(pathname, requestId)), {
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
          status: 429,
        });
      }
    } catch (error) {
      appLogger.error({ error, msg: "Global rate limiter experienced an error. Bypassing." });
    }
  }

  return null;
}
```

Update the call at line 95:

```ts
  const rateLimitResponse = await handleRateLimitAndSize(request, pathname, ip, requestId);
```

Add `buildRateLimitBody` to the existing import from `./shared/lib/proxy-routing`.

- [ ] **Step 6: Stabilize the error-message callback**

In `apps/web/src/shared/i18n/use-error-message.ts`:

Add `useCallback` to the React import (the file currently has no React import; add `import { useCallback } from "react";` above the package imports).

Replace the returned arrow at lines 189-201 with:

```ts
  return useCallback(
    (error: unknown): string => {
      const { message, messageCode, params } = readErrorPayload(error);

      if (messageCode != null) {
        return t(messageKeyFor(messageCode), params);
      }

      if (!IS_PROD && message != null) {
        return message;
      }

      return t("generic");
    },
    [t],
  );
```

- [ ] **Step 7: Use it in the GitHub install hook**

In `apps/web/src/widgets/welcome-flow/model/use-github-install.ts`:

Add the import:

```ts
import { useErrorMessage } from "@/shared/i18n/use-error-message";
```

Inside the hook:

```ts
  const errorMessage = useErrorMessage();
```

Replace the two `toast.error(t("github_error"))` calls with:

```ts
          toast.error(errorMessage(error));
```

and, in the `.catch`, name the parameter:

```ts
      .catch((error: unknown) => {
        trackClientEvent("github_app_install_failed");
        toast.error(errorMessage(error));
      })
```

Remove the now-unused `t` binding and the `useTranslations` import if nothing else uses it.

- [ ] **Step 8: Use it in the welcome-flow query error**

In `apps/web/src/widgets/welcome-flow/model/use-welcome-flow.ts`, replace the effect at lines 83-88 with:

```ts
  useEffect(() => {
    if (error == null) {
      return;
    }

    toast.error(errorMessage(error));
    void setError(null);
  }, [error, errorMessage, setError]);
```

`errorMessage` is already defined at line 51; do not add a second binding.

- [ ] **Step 9: Verify**

```bash
bun --filter @doxynix/web test src/shared/lib/proxy-routing.test.ts
bun --filter @doxynix/web test src/shared/i18n/use-error-message.test.ts
bun run type-check
```

Expected: all exit 0. The existing `use-error-message` tests must still pass after `useCallback`.

- [ ] **Step 10: Manual verification**

Run `bun run dev` and fire 25 rapid requests from the browser console on any page (the limiter is production-only unless `IS_RATE_LIMIT_ENABLED` is set locally, so if the limiter is disabled, verify the body builder through the unit test instead). Expected when enabled: the toast reads «Слишком много попыток. Повторите позже.», not «Что-то пошло не так». Stop the server.

- [ ] **Step 11: Format and commit**

```bash
bun run format
git add apps/web/src/shared/lib/proxy-routing.ts apps/web/src/shared/lib/proxy-routing.test.ts apps/web/src/proxy.ts apps/web/src/shared/i18n/use-error-message.ts apps/web/src/widgets/welcome-flow/model/use-github-install.ts apps/web/src/widgets/welcome-flow/model/use-welcome-flow.ts
git commit -m "fix(web): surface rate limits with a specific error"
```

---

## Task 8: Drop the redundant forecast point for today

**Files:**
- Modify: `apps/web/src/features/manage-subscription/model/usage-forecast.ts:128-143`
- Modify: `apps/web/src/features/manage-subscription/model/usage-forecast.test.ts` (append)

**Interfaces:**
- Consumes: nothing new; `UsageForecast` already exposes `daysElapsed` and `daysTotal`.
- Produces: no signature change. Invariant: `chartRows[daysElapsed - 1].forecast === null`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/features/manage-subscription/model/usage-forecast.test.ts`:

```ts
  it("does not duplicate today's actual usage as a forecast point", () => {
    const { periodStart, periodEnd } = periodOf(11);
    const now = new Date(periodStart.getTime() + 5.2 * DAY_MS);

    const forecast = buildUsageForecast({
      limit: 100,
      now,
      periodEnd,
      periodStart,
      series: [],
      used: 30,
    });

    const today = forecast.chartRows.find((row) => row.day === forecast.daysElapsed);

    expect(today?.actual).not.toBeNull();
    expect(today?.forecast).toBeNull();
    expect(forecast.chartRows.at(-1)?.day).toBe(forecast.daysTotal);
    expect(forecast.chartRows.at(-1)?.forecast).toBe(forecast.projectedPercent);
  });
```

Place it inside the existing top-level `describe` block, next to the other `buildUsageForecast` cases.

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --filter @doxynix/web test src/features/manage-subscription/model/usage-forecast.test.ts
```

Expected: FAIL — `today?.forecast` is the same number as `today?.actual`, not `null`.

- [ ] **Step 3: Remove the today branch**

In `apps/web/src/features/manage-subscription/model/usage-forecast.ts`, replace lines 130-143 with:

```ts
  for (let day = 1; day <= daysTotal; day += 1) {
    const actual = actualByDay.get(day) ?? null;
    let forecast: null | number = null;

    if (day > daysElapsed) {
      forecast =
        day === daysTotal
          ? projectedPercent
          : projectable
            ? percent + (day - daysElapsed) * averagePercentPerDay
            : percent;
    }

    chartRows.push({ actual, day, forecast });
  }
```

- [ ] **Step 4: Run the whole forecast suite**

```bash
bun --filter @doxynix/web test src/features/manage-subscription/model/usage-forecast.test.ts
```

Expected: all tests pass. The existing test `publishes no forecast before a full day has elapsed` still passes because `day === daysTotal (11) > daysElapsed (1)`.

- [ ] **Step 5: Manual verification**

Run `bun run dev`, open «Настройки → Биллинг». Expected: the forecast line starts after today; the today marker is still visible via `ReferenceDot`; no duplicate point sits on top of the solid actual line. Stop the server.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add apps/web/src/features/manage-subscription/model/usage-forecast.ts apps/web/src/features/manage-subscription/model/usage-forecast.test.ts
git commit -m "fix(web): drop the redundant forecast point for today"
```

---

## Task 9: Code viewer uses the selected branch and stops stale syntax errors

**Files:**
- Modify: `apps/web/src/entities/repo/model/editor-extensions.ts:103-120, 164-190, 325-331`
- Create: `apps/web/src/entities/repo/model/editor-extensions.test.ts`
- Modify: `apps/web/src/entities/repo/ui/repo-code-editor.tsx:1-18, 39-73, 140-190`
- Modify: `apps/web/src/features/repo-code-viewer/ui/repo-code-container.tsx:1-50`

**Interfaces:**
- Consumes: `useRepoBranch(repo)` (nuqs `branch` state, already used by the tree), CodeMirror `EditorState`.
- Produces: `collectSyntaxDiagnostics(state: EditorState, message: string): Diagnostic[]`, `buildSyntaxLinter(message: string): Extension`, `buildEditorExtensions(options: { syntaxError: string; syntaxLint?: boolean }): Extension[]`.

- [ ] **Step 1: Write the failing diagnostics test**

Create `apps/web/src/entities/repo/model/editor-extensions.test.ts`:

```ts
import { languages } from "@codemirror/language-data";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { collectSyntaxDiagnostics } from "./editor-extensions";

async function stateFor(doc: string): Promise<EditorState> {
  const descriptor = languages.find((language) => language.name === "JavaScript");
  if (descriptor == null) {
    throw new Error("JavaScript language descriptor is missing");
  }

  const support = await descriptor.load();
  return EditorState.create({ doc, extensions: [support] });
}

describe("collectSyntaxDiagnostics", () => {
  it("reports nothing for valid JavaScript", async () => {
    expect(collectSyntaxDiagnostics(await stateFor("const value = 1;\n"), "syntax")).toEqual([]);
  });

  it("reports an error node for incomplete JavaScript", async () => {
    expect((await stateFor("const value = ;\n")).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --filter @doxynix/web test src/entities/repo/model/editor-extensions.test.ts
```

Expected: FAIL — `collectSyntaxDiagnostics` is not exported.

- [ ] **Step 3: Extract the collector and add the lint toggle**

In `apps/web/src/entities/repo/model/editor-extensions.ts`, replace `createUniversalSyntaxLinter` (lines 103-120) with:

```ts
export function collectSyntaxDiagnostics(
  state: EditorState,
  syntaxErrorMessage: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  syntaxTree(state)
    .cursor()
    .iterate((node) => {
      if (node.type.isError) {
        diagnostics.push({
          from: node.from,
          message: syntaxErrorMessage,
          severity: "error",
          to: node.to,
        });
      }
    });

  return diagnostics;
}

function createUniversalSyntaxLinter(syntaxErrorMessage: string) {
  return linter((view) => collectSyntaxDiagnostics(view.state, syntaxErrorMessage));
}

export function buildSyntaxLinter(syntaxErrorMessage: string): Extension {
  return createUniversalSyntaxLinter(syntaxErrorMessage);
}
```

`EditorState` is already imported at line 21; do not add it again.

- [ ] **Step 4: Gate the linter behind a flag**

In the same file, change `getIdeOnlyExtensions` (line 164) to:

```ts
function getIdeOnlyExtensions(
  labels: { syntaxError: string },
  syntaxLint: boolean,
): Extension[] {
```

Replace line 187 (`createUniversalSyntaxLinter(labels.syntaxError),`) with:

```ts
    ...(syntaxLint ? [createUniversalSyntaxLinter(labels.syntaxError)] : []),
```

Change `buildEditorExtensions` (lines 325-331) to:

```ts
export function buildEditorExtensions(options: {
  syntaxError: string;
  syntaxLint?: boolean;
}): Extension[] {
  return [
    ...BASE_EXTENSIONS,
    ...getIdeOnlyExtensions({ syntaxError: options.syntaxError }, options.syntaxLint ?? true),
    THEME_EXTENSION,
  ];
}
```

- [ ] **Step 5: Run the diagnostics test**

```bash
bun --filter @doxynix/web test src/entities/repo/model/editor-extensions.test.ts
```

Expected: `Tests  2 passed`.

- [ ] **Step 6: Update the editor**

In `apps/web/src/entities/repo/ui/repo-code-editor.tsx`:

Change the React import and the lint import:

```ts
import { type ComponentType, useEffect, useRef, useState } from "react";
import { diagnosticCount, setDiagnostics } from "@codemirror/lint";
```

Change the model import:

```ts
import { buildEditorExtensions, buildSyntaxLinter } from "../model/editor-extensions";
```

Add refs after the `useState`/`useTheme` declarations:

```ts
  const viewRef = useRef<EditorView | null>(null);
  const lastErrorsRef = useRef<number | null>(null);
```

Initialize the extensions without the linter:

```ts
  const [ext, setExt] = useState<Extension[]>(() =>
    buildEditorExtensions({ syntaxError: t("editor_syntax_error"), syntaxLint: false }),
  );
```

Replace the body of `loadDynamicLanguage` (lines 45-73) with:

```ts
    async function loadDynamicLanguage() {
      const baseExtensions = buildEditorExtensions({
        syntaxError: t("editor_syntax_error"),
        syntaxLint: false,
      });

      try {
        const languageSupport = await loadLanguageExtension(path);
        const nextExt: Extension[] = [...baseExtensions];

        if (languageSupport) {
          nextExt.push(languageSupport);
          nextExt.push(buildSyntaxLinter(t("editor_syntax_error")));
        }

        if (!cancelled) {
          setExt(nextExt);
        }
      } catch (error) {
        console.error("Failed to load language support", error);
        if (!cancelled) {
          setExt(baseExtensions);
        }
      }
    }
```

Add a reset effect after the language effect:

```ts
  useEffect(() => {
    const view = viewRef.current;
    if (view == null) {
      return;
    }

    view.dispatch(setDiagnostics(view.state, []));
    lastErrorsRef.current = null;
  }, [path]);
```

In `onCreateEditor` (lines 147-149), store the view:

```tsx
        onCreateEditor={(view) => {
          viewRef.current = view;
          onViewCreated?.(view);
        }}
```

In `onUpdate`, replace the condition and record the count (around line 157):

```tsx
          const errors = diagnosticCount(update.state);

          if (
            onStats &&
            (update.docChanged ||
              update.selectionSet ||
              searchChanged ||
              errors !== lastErrorsRef.current)
          ) {
            lastErrorsRef.current = errors;
```

Replace the `errors: diagnosticCount(state),` line in the `onStats` payload with:

```ts
              errors,
```

- [ ] **Step 7: Pass the branch to the file query**

In `apps/web/src/features/repo-code-viewer/ui/repo-code-container.tsx`:

Add the import:

```ts
import { useRepoBranch } from "@/entities/repo/model/use-repo-branch";
```

Inside the component, next to `useRepoParams`:

```ts
  const { branch } = useRepoBranch(repo);
```

Replace the query input (lines 39-44) with:

```ts
  const { data, isLoading } = useQuery(
    trpc.githubBrowse.getFileContent.queryOptions(
      { branch, path: path ?? "", repoId: repo.id },
      { enabled: path != null && path !== "" },
    ),
  );
```

The query key now includes `branch`, so changing the branch refetches the file.

- [ ] **Step 8: Verify tests, types and locales**

```bash
bun --filter @doxynix/web test src/entities/repo/model/editor-extensions.test.ts
bun run type-check
bun --filter @doxynix/web lint:locales
```

Expected: all exit 0.

- [ ] **Step 9: Manual verification**

Run `bun run dev`, open repo → «Код»:

1. Open a valid `.ts` file. Expected: the status bar shows `0` errors.
2. Switch to another file. Expected: the count resets immediately, then shows that file's real diagnostics after the lint debounce (≈750 ms); it never shows the previous file's count.
3. Switch the branch in the selector. Expected: the file content changes to the selected branch (or a not-found state), not the default branch.
4. Open a deliberately incomplete file. Expected: syntax errors still appear as errors.

Stop the server.

- [ ] **Step 10: Format and commit**

```bash
bun run format
git add apps/web/src/entities/repo/model/editor-extensions.ts apps/web/src/entities/repo/model/editor-extensions.test.ts apps/web/src/entities/repo/ui/repo-code-editor.tsx apps/web/src/features/repo-code-viewer/ui/repo-code-container.tsx
git commit -m "fix(web): stop stale syntax errors in the code viewer"
```

---

## Task 10: Full gate

**Files:** none.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a verified branch ready for review.

- [ ] **Step 1: Run the repo gate**

```bash
bun run validate
```

Expected: exit 0. This runs format check, Oxlint, type-check, unit tests, `lint:i18n`, `lint:locales`, `lint:message-codes`, `lint:fsd`, `arch:check`, cspell, secretlint and dup/knip per the root turbo pipeline.

- [ ] **Step 2: Re-run the touched unit suites explicitly**

```bash
bun --filter @doxynix/web test src/server/modules/users/user.mapper.test.ts
bun --filter @doxynix/web test src/shared/lib/proxy-routing.test.ts
bun --filter @doxynix/web test src/features/manage-subscription/model/usage-forecast.test.ts
bun --filter @doxynix/web test src/features/repo-docs-viewer/model/floating-card-stats.test.ts
bun --filter @doxynix/web test src/shared/lib/two-factor-error.test.ts
bun --filter @doxynix/web test src/entities/repo/model/editor-extensions.test.ts
```

Expected: every command exits 0.

- [ ] **Step 3: Manual acceptance checklist**

Run `bun run dev` and confirm, in this order:

1. `DELETE` typed as `delete` does not enable account deletion.
2. Rotate-key alert title is readable in dark and light themes.
3. Connections GitHub card shows «Подключено как <identity>».
4. Audit-log eye lights on hover anywhere in the button; Tab reveals it.
5. Hovering `package.json` in repo docs opens the card without a console error.
6. Wrong 2FA code shows «Неверный код подтверждения.».
7. A 429 produces the rate-limit message, not the generic one.
8. The billing forecast has no point on today.
9. Code viewer: no stale error count, and switching a branch changes the file.

- [ ] **Step 4: Inspect the final diff**

```bash
git log --oneline main..HEAD
git diff --stat main...HEAD
```

Expected: nine commits (one per task), no generated files, no unrelated files.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin HEAD
```

Expected: the pre-push hook runs `bun run type-check` and passes. Open the PR against `main`, link the Linear issue in the body, and keep the PR title in Conventional Commits form (`fix(web): ...`).
