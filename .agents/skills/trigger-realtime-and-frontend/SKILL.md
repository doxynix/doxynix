---
name: trigger-realtime-and-frontend
description: >
  Trigger.dev client/frontend surface: subscribe to runs in realtime
  (runs.subscribeToRun and the @trigger.dev/react-hooks hook useRealtimeRun),
  consume metadata and AI/text streams in React (useRealtimeStream), trigger
  tasks from the browser (useTaskTrigger, useRealtimeTaskTrigger), and mint
  scoped frontend credentials with auth.createPublicToken /
  auth.createTriggerPublicToken.
  Load when wiring a frontend (React/Next.js/Remix) or backend-for-frontend to
  show live run progress, status badges, token streams, trigger buttons, or
  wait-token approval UIs. NOT for writing the backend task itself (streams.define
  / metadata.set is trigger-authoring-tasks territory); this is the consumer side.
---

# Realtime and Frontend

The full, version-pinned reference ships **inside your installed `@trigger.dev/sdk`**. Read it before writing code — it always matches the SDK version in this project, so it never drifts.

Bun installs per workspace, so there is **no root `node_modules/@trigger.dev`**. The real paths are
relative to `apps/web`:

- **Skill:** `apps/web/node_modules/@trigger.dev/sdk/skills/trigger-realtime-and-frontend/SKILL.md` —
  run subscriptions, `@trigger.dev/react-hooks`, streams, frontend triggering, and scoped tokens.
- **Docs:** `apps/web/node_modules/@trigger.dev/sdk/docs/realtime/`; the skill's frontmatter lists
  the exact pages it draws from. Grep for a hook, e.g.
  `grep -rl "useRealtimeRun" apps/web/node_modules/@trigger.dev/sdk/docs/`.

## Repo notes

- Trigger.dev lives only in `apps/web` (`@trigger.dev/sdk`, `@trigger.dev/build` and
  `@trigger.dev/react-hooks` all `4.6.4`). There is no Trigger setup in `apps/siem-server` either.
- `apps/web` is Next.js App Router, so every component using these hooks needs `"use client"` at the
  top; a server component cannot subscribe.
- Frontend code lives under the FSD layers (`app/`, `widgets/`, `features/`, `entities/`, `shared/`)
  and is gated by `bun run lint:fsd` — a run-status widget composed from a feature belongs in
  `widgets/`, not inside the feature. See the `feature-sliced-design` skill.
- Tasks themselves live in `apps/web/src/server/modules/<slice>/tasks/*.task.ts` — see
  trigger-authoring-tasks.

## Common mistakes

1. **CRITICAL: Triggering from the browser with a Public Access Token.** The
   read token from `createPublicToken` cannot trigger tasks.
   - Wrong: `useTaskTrigger("my-task", { accessToken: publicAccessTokenFromCreatePublicToken })`
   - Correct: mint a single-use Trigger Token with `auth.createTriggerPublicToken("my-task")` and pass that.

2. **Token with no scopes.** A scopeless token authorizes nothing, so every subscribe 403s.
   - Wrong: `await auth.createPublicToken()`
   - Correct: `await auth.createPublicToken({ scopes: { read: { runs: ["run_1234"] } } })`

3. **Polling with `useRun`/SWR for live updates.** `useRun` is the SWR-based
   management-API hook (not recommended for live state); set `refreshInterval: 0`
   to stop polling if you do use it.
   - Wrong: `useRun(runId, { refreshInterval: 1000 })` to track progress
   - Correct: `useRealtimeRun(runId, { accessToken })` (no polling, no WebSocket setup)

4. **Forgetting `"use client"`.** Realtime/trigger hooks cannot run in a server component.
   - Wrong: a Next.js App Router server component using `useRealtimeRun`
   - Correct: put `"use client";` at the top of any component using these hooks.

5. **Shipping `payload`/`output` you do not render.**
   - Wrong: `useRealtimeRun(runId, { accessToken })` for a status badge (large payloads over the wire)
   - Correct: `useRealtimeRun(runId, { accessToken, skipColumns: ["payload", "output"] })`

6. **Subscribing before the handle exists.**
   - Wrong: `useRealtimeRun(handle, { accessToken: handle?.publicAccessToken })` with no guard
   - Correct: add `enabled: !!handle` so it subscribes only once the trigger returns a handle.

## References

Sibling skills: **trigger-authoring-tasks** (the task side: `streams.define()`, `metadata.set()`, `wait.createToken`), **trigger-authoring-chat-agent** and **trigger-chat-agent-advanced** (chat agents build on these realtime streams).
