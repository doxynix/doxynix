---
name: vitest
description: Vitest fast unit testing framework powered by Vite with Jest-compatible API. Use when writing tests, mocking, configuring coverage, or working with test filtering and fixtures.
---

Vitest is a next-generation testing framework powered by Vite. It provides a Jest-compatible API with native ESM, TypeScript, and JSX support out of the box. Vitest shares the same config, transformers, resolvers, and plugins with your Vite app.

**Key Features:**
- Vite-native: Uses Vite's transformation pipeline for fast HMR-like test updates
- Jest-compatible: Drop-in replacement for most Jest test suites
- Smart watch mode: Only reruns affected tests based on module graph
- Native ESM, TypeScript, JSX support without configuration
- Multi-threaded workers for parallel test execution
- Built-in coverage via V8 or Istanbul
- Snapshot testing, mocking, and spy utilities

## Doxynix

Vitest is **5.0.2 (stable, not beta)**, declared in the root `catalog` and pinned per-workspace.

- Tests exist **only in `apps/web`**. `apps/siem-server`, `packages/cli`, `packages/config`
  and `packages/shared` have no `test` script and no vitest dependency — do not try to run vitest there.
- Everything below is executed with Bun. Never `npm`, `npx`, `pnpm` or `yarn`.

| Command | Script |
|---------|--------|
| `bun --filter @doxynix/web test` | `cross-env TZ=UTC vitest run --config vitest.config.ts --no-file-parallelism` |
| `bun --filter @doxynix/web test:unit` | unit run scoped to `src` |
| `bun --filter @doxynix/web test:coverage` | V8 coverage, same TZ/serial flags |
| `bun --filter @doxynix/web test:int` | `vitest run --config vitest.integration.config.ts` |

Every `test*` script is wrapped by the workspace's `with-doppler` helper (which runs
`scripts/doppler.ts`), so the Doppler CLI must be installed and logged in locally; `CI=true` passes
straight through. Always invoke it through `bun --filter`, never from the repo root — there is no
root-level `with-doppler` script.

Run a single file through the same wrapper:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/analysis.mapper.test.ts
```

Do not reach for `bunx vitest` — it skips the Doppler wrapper, the `TZ=UTC` pin and
`--no-file-parallelism`.

### Unit vs integration

`vitest.config.ts` sets `exclude: ["src/tests/integration/**/*", ...]` and integration tests need a
**real** Postgres plus `cleanupDatabase()` that `TRUNCATE`s shared tables between files. A CLI path
filter cannot override `exclude`, so the two suites are separate scripts by design. See
`CONTRIBUTING.md` for the `dxnx_web_test` database setup.

### Lint rules that fail the build

`.oxlintrc.json` enables the `vitest` plugin with these severities, so `bun run lint` fails on:

- `vitest/no-focused-tests` — **error**. `.only` is never allowed.
- `vitest/expect-expect` — **error**. Every test needs an `expect`-family call. The configured
  `assertFunctionNames` are `expect`, `expectDenied`, `expectValidationFail`, `fc.assert`.
- `vitest/prefer-expect-resolves` — **error**. Use `await expect(p).resolves` over try/catch.

Test files also get a relaxed `.oxlintrc.json` override (no-non-null-assertion and several
type-safety rules are `off` there).

## Core

| Topic | Description | Reference |
|-------|-------------|-----------|
| Configuration | Vitest and Vite config integration, defineConfig usage | [core-config](references/core-config.md) |
| CLI | Command line interface, commands and options | [core-cli](references/core-cli.md) |
| Test API | test/it function, modifiers like skip, only, concurrent | [core-test-api](references/core-test-api.md) |
| Describe API | describe/suite for grouping tests and nested suites | [core-describe](references/core-describe.md) |
| Expect API | Assertions with toBe, toEqual, matchers and asymmetric matchers | [core-expect](references/core-expect.md) |
| Hooks | beforeEach, afterEach, beforeAll, afterAll, aroundEach | [core-hooks](references/core-hooks.md) |

## Features

| Topic | Description | Reference |
|-------|-------------|-----------|
| Mocking | Mock functions, modules, timers, dates with vi utilities | [features-mocking](references/features-mocking.md) |
| Snapshots | Snapshot testing with toMatchSnapshot and inline snapshots | [features-snapshots](references/features-snapshots.md) |
| Coverage | Code coverage with V8 or Istanbul providers | [features-coverage](references/features-coverage.md) |
| Test Context | Test fixtures, context.expect, test.extend for custom fixtures | [features-context](references/features-context.md) |
| Concurrency | Concurrent tests, parallel execution, sharding | [features-concurrency](references/features-concurrency.md) |
| Filtering | Filter tests by name, file patterns, tags | [features-filtering](references/features-filtering.md) |
| Test Tags | Label tests with tags to filter runs and apply shared options | [features-test-tags](references/features-test-tags.md) |
| Reporters | Built-in reporters, default selection, CI/output config | [features-reporters](references/features-reporters.md) |
| Benchmarking | Write benchmarks with the bench fixture (Tinybench) | [features-benchmarking](references/features-benchmarking.md) |

## Advanced

| Topic | Description | Reference |
|-------|-------------|-----------|
| Vi Utilities | vi helper: mock, spyOn, fake timers, hoisted, waitFor | [advanced-vi](references/advanced-vi.md) |
| Environments | Test environments: node, jsdom, happy-dom, custom | [advanced-environments](references/advanced-environments.md) |
| Type Testing | Type-level testing with expectTypeOf and assertType | [advanced-type-testing](references/advanced-type-testing.md) |
| Projects | Multi-project workspaces, different configs per project | [advanced-projects](references/advanced-projects.md) |
