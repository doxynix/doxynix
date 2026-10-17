---
name: ai-sdk
description: 'Answer questions about the AI SDK and help build AI-powered features. Use when developers: (1) Ask about AI SDK functions like generateText, streamText, ToolLoopAgent, embed, or tools, (2) Want to build AI agents, chatbots, RAG systems, or text generation features, (3) Have questions about AI providers (OpenAI, Anthropic, Google, etc.), streaming, tool calling, structured output, or embeddings, (4) Use React hooks like useChat or useCompletion. Triggers on: "AI SDK", "Vercel AI SDK", "generateText", "streamText", "add AI to my app", "build an agent", "tool calling", "structured output", "useChat".'
---

## What the AI SDK Is

The AI SDK by Vercel (the `ai` package) is a TypeScript toolkit for building AI applications. It provides a unified API across model providers for text generation, structured output, tool calling, agents, embeddings, and framework UI integrations.

- Repository: https://github.com/vercel/ai
- Documentation: https://ai-sdk.dev/docs

## Doxynix setup

`ai` **7.0.118** lives in `apps/web` only. Nothing else in the monorepo depends on it.

| Package | Version | Where it's used |
|---------|---------|-----------------|
| `ai` | 7.0.118 | `server/utils/call.ts`, `server/modules/agent/*`, `app/api/agent/chat/route.ts` |
| `@ai-sdk/google` | 4.0.82 | `server/core/ai/google.ts`, Gemini models |
| `@ai-sdk/openai` | 4.0.78 | `server/core/ai/ai-constants.ts` — `createOpenAI` pointed at the Groq base URL |
| `@ai-sdk/react` | 4.0.121 | `features/agent/ui/agent.tsx` (`useChat`) |

**No AI Gateway.** There is no `@ai-sdk/gateway` dependency, no `gateway()` provider factory and no
`AI_GATEWAY_API_KEY` anywhere in `apps/web`. Models are referenced directly through
`createGoogleGenerativeAI(...)` and `createOpenAI({ baseURL: "https://api.groq.com/openai/v1" })`.
Do not introduce Gateway routing as part of an unrelated task.

Model IDs come from `DEFAULT_AI_MODELS` in `src/server/core/ai/ai-constants.ts`, keyed by role
(`AGENT`, `ARCHITECT`, `CARTOGRAPHER`, `FALLBACK`, `POWERFUL`, `SENTINEL`, `WRITER`) and overridable
from Edge Config (`@vercel/global-config`) via `getActiveModels()`. Model lifecycle is Trigger.dev's
job here — see the `analysis-engine` and `trigger-authoring-tasks` skills.

Package installs use Bun (`bun add ai`), never npm/pnpm/yarn.

## Critical: Do Not Trust Your Own Memory

Whatever you remember about the AI SDK is likely outdated. The SDK changes frequently across versions - APIs are renamed, removed, and added. Your training data almost certainly contains obsolete APIs, deprecated patterns, and model IDs that no longer exist. UI hooks like `useChat` are among the most frequently changed APIs, so be especially careful with client code.

**Never write AI SDK code from memory.** Always verify every API, option, and pattern against the documentation and source code for the version that is actually installed in the project.

## Use the Bundled, Version-Matched Docs

The `ai` package ships its full documentation and source code inside `node_modules`. These always match the installed version, so trust them over anything you remember.

1. Ensure `ai` is installed. If `node_modules/ai/` does not exist, install **only** the `ai` package with `bun add ai` from inside `apps/web`. Install provider packages (e.g. `@ai-sdk/openai`) and framework packages (e.g. `@ai-sdk/react`) later, when the task requires them.
2. Read and grep the bundled docs at `node_modules/ai/docs/` and the source at `node_modules/ai/src/`.
3. Provider and framework packages bundle their own docs at `node_modules/@ai-sdk/<name>/docs/`.
4. If something isn't in the bundled docs, search https://ai-sdk.dev/docs. You can append `.md` to any docs page URL to get its markdown, and search via `https://ai-sdk.dev/api/search-docs?q=your_query`.
5. If you cannot find support for an answer in the docs or source, say so explicitly — do not guess.

## AI Gateway — not used here

The Vercel AI Gateway is a valid AI SDK feature, but this repo does not use it: no `@ai-sdk/gateway`
dependency, no `gateway()` factory, no `AI_GATEWAY_API_KEY`. Provider packages are configured
directly in `src/server/core/ai/`. Do not suggest Gateway setup, `provider/model` gateway strings, or
`https://ai-gateway.vercel.sh/v1/models` queries for this codebase — those would be dead ends.

## Choosing a Model

Model IDs are **role-keyed** in `DEFAULT_AI_MODELS` (`src/server/core/ai/ai-constants.ts`), typed as
`GoogleModelId | GroqModelId` derived from `Parameters<typeof google>[0]` and
`Parameters<typeof groq>[0]` — so an invalid ID is a compile error, not a runtime surprise. Add or
change a model there (and in the Edge Config `AI_MODELS_CONFIG` override) rather than hardcoding a
string at the call site.

Never use model IDs from memory; verify against the provider package's bundled types and docs.

## Building and Consuming Agents

Use the SDK's built-in agent abstraction (such as `ToolLoopAgent`) rather than hand-rolling tool-calling loops. For end-to-end type safety, infer the UI message type from your agent definition when consuming it on the client (e.g. with `useChat`). Consuming an agent is framework-specific: check `package.json` to detect the stack, then follow the matching quickstart.

Look up the current agent, tool, and type-safety APIs in the bundled docs (`node_modules/ai/docs/`, especially the agents section) or at https://ai-sdk.dev/docs.

## After Making Changes

Run `bun run type-check` (Turbo, covers every workspace) — `apps/web` type-check is memory-heavy and
needs the generated Prisma/ZenStack client, so go through Turbo rather than invoking `bun check` directly.
Be minimal: only set options that differ from the defaults, checking docs or source for the defaults
rather than over-specifying. Most type errors come from remembered, now-changed APIs.

AI SDK DevTools is not installed in this repo; don't add it uninvited.
