# Vercel Deployment

`apps/web` deploys to Vercel (`apps/web/vercel.json` exists; `VERCEL` and `VERCEL_ENV` are in
`turbo.json`'s `globalEnv`). The other workspaces do not.

## Remote Cache on Vercel

Remote caching is enabled automatically when Vercel detects Turborepo at the repo root — no
`TURBO_TOKEN` / `TURBO_TEAM` setup required there. Cache is shared across deployments, so preview
and production builds both benefit.

Outside Vercel (CI, laptops) those two variables are what authenticate against the remote cache;
they are declared in `globalEnv` in `turbo.json`.

## Build Command

Vercel auto-detects turbo when `turbo.json` is at the repo root. To scope it to one workspace:

```bash
turbo build --filter=@doxynix/web
```

For production-only env strictness:

```bash
turbo build --filter=@doxynix/web --env-mode=strict
```

`--env-mode=strict` makes the build fail on a missing declared env var instead of silently
treating it as empty — worth it in production, painful in preview.

## turbo-ignore

Skip a deployment when nothing relevant changed.

### Invocation

```bash
bun x turbo-ignore
```

To add it as a devDependency instead:

```bash
bun add -d turbo-ignore
```

### Vercel setup

1. Project → Settings → Git → Ignored Build Step
2. Custom, and enter `bun x turbo-ignore`

### How it works

`turbo-ignore` compares the current commit against the last successful deployment, using
Turborepo's dependency graph:

1. exit 0 → nothing relevant changed → skip the build
2. exit 1 → something changed → build

### Options

```bash
bun x turbo-ignore @doxynix/web                    # check one workspace
bun x turbo-ignore --fallback=HEAD~1              # explicit comparison ref
bun x turbo-ignore --task=test                    # task other than build
bun x turbo-ignore --directory=apps/web           # run in a specific directory
bun x turbo-ignore --turbo-version=2.11.4         # explicit turbo version
bun x turbo-ignore --max-buffer=2048              # raise child maxBuffer (KB, default 1024)
```

## Monorepo Root Directory

Vercel's project Root Directory is `apps/web`. From there it:

- installs dependencies from the monorepo root
- runs the build in `apps/web`
- applies framework settings

This is why `turbo.json` and `bun.lock` live at the root and must stay there.

## Environment Variables

Set them in Vercel per environment (Production / Preview / Development). Secrets from Doppler are
injected at runtime; anything the **build** needs (a public URL, a build-time token) must exist as
a plain Vercel env var, because the build runs before Doppler secrets are available.

Anything the build reads should also be declared in that task's `env` array in `turbo.json`, or
Turbo will not hash it and a cached build can replay with a stale value.