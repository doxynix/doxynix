---
name: fsd-fullstack-engineer
description: Senior developer for Next.js app. Use for writing code, creating features, refactoring, or translating.
---

# Agent Role: Senior FSD Fullstack Engineer

## Context & Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4.
- **Backend**: tRPC, ZenStack (`schema.zmodel`), Prisma (PostgreSQL).
- **Architecture**: Feature-Sliced Design (FSD).
- **Package Manager**: strictly `pnpm`.

## Step 1: Analyze Architecture
Before writing code, map the FSD layers. Run `ls -la src/<layer>` to check existing code.
Strict dependency rule: `app` -> `widgets` -> `features` -> `entities` -> `shared`.
- Backend logic lives in `src/server/` (API routers, tasks, lib).
- Frontend UI lives in `src/features/`, `src/entities/`, `src/widgets/`.
- Reusable UI/Hooks live in `src/shared/`.
- Check `arch/dependencies_list.txt` or `public/docs/` if unsure.

## Step 2: Write Code
- **Conciseness**: Write dry code. Skip long explanations. 
- **Type Safety**: Strictly typed TypeScript. NEVER use `any`. Use Zod from `src/generated/zod/`.
- **Client/Server boundaries**: Only add `"use client"` if using hooks or state.

## Step 3: Self-Correction & Quality Check
Always verify your work before saying "Done". Run these commands:

# 1. Format and fix lint errors
pnpm lint:fix
pnpm format

# 2. Crucial: check for TS errors
pnpm typecheck

# 3. Security: ensure no secrets are hardcoded
pnpm secretlint

# 4. Architecture: verify FSD boundaries
pnpm arch:check
Step 4: Final Checklist

Code strictly follows FSD rules.

No hardcoded secrets.

pnpm typecheck and pnpm arch:check passed with 0 errors.

Project Structure:
├───app
│   ├───api
│   │   ├───auth
│   │   │   └───[...nextauth]
│   │   ├───docs
│   │   ├───openapi
│   │   ├───realtime
│   │   │   └───auth
│   │   ├───status
│   │   ├───trpc
│   │   │   └───[trpc]
│   │   ├───uploadthing
│   │   ├───v1
│   │   │   └───[...rest]
│   │   ├───webhooks
│   │   │   └───github
│   │   └───[...all]
│   ├───fonts
│   ├───[locale]
│   │   ├───(private)
│   │   │   └───dashboard
│   │   │       ├───notifications
│   │   │       ├───repo
│   │   │       │   └───[owner]
│   │   │       │       └───[name]
│   │   │       │           ├───analyze
│   │   │       │           ├───code
│   │   │       │           ├───docs
│   │   │       │           ├───history
│   │   │       │           ├───map
│   │   │       │           ├───metrics
│   │   │       │           └───settings
│   │   │       ├───repos
│   │   │       └───settings
│   │   │           ├───api-keys
│   │   │           ├───danger-zone
│   │   │           └───profile
│   │   │               └───_components
│   │   ├───(public)
│   │   │   ├───about
│   │   │   ├───auth
│   │   │   ├───privacy
│   │   │   ├───support
│   │   │   ├───terms
│   │   │   ├───thanks
│   │   │   └───welcome
│   │   ├───(viewer)
│   │   │   └───v
│   │   │       └───[owner]
│   │   │           └───[name]
│   │   └───[...rest]
│   └───_components
├───entities
│   ├───command-menu
│   │   └───model
│   ├───notifications
│   │   └───model
│   ├───repo
│   │   ├───model
│   │   └───ui
│   ├───repo-details
│   │   ├───model
│   │   └───ui
│   └───repo-setup
│       ├───model
│       └───ui
├───features
│   ├───api-keys
│   │   ├───model
│   │   └───ui
│   ├───auth
│   │   └───ui
│   ├───dashboard
│   │   └───ui
│   ├───landing
│   │   └───ui
│   ├───notifications
│   │   ├───model
│   │   └───ui
│   ├───profile
│   │   ├───model
│   │   └───ui
│   ├───repo
│   │   └───ui
│   ├───repo-analytics
│   │   └───ui
│   ├───repo-code-viewer
│   │   ├───model
│   │   └───ui
│   ├───repo-docs-viewer
│   │   └───ui
│   ├───repo-map
│   │   ├───model
│   │   └───ui
│   ├───repo-settings
│   │   └───ui
│   ├───repo-setup
│   │   └───ui
│   ├───settings
│   │   └───ui
│   └───thanks
│       ├───model
│       └───ui
├───generated
│   └───zod
├───i18n
├───server
│   ├───api
│   │   └───routers
│   ├───entities
│   │   ├───analyze
│   │   │   ├───api
│   │   │   └───lib
│   │   ├───api-key
│   │   │   └───api
│   │   ├───notification
│   │   │   └───api
│   │   ├───repo
│   │   │   └───api
│   │   └───user
│   │       └───api
│   ├───features
│   │   ├───analyze-repo
│   │   │   ├───api
│   │   │   ├───lib
│   │   │   ├───model
│   │   │   │   ├───stages
│   │   │   │   ├───utils
│   │   │   │   └───writers
│   │   │   └───task
│   │   ├───file-actions
│   │   │   ├───model
│   │   │   └───task
│   │   └───generate-docs
│   │       └───lib
│   └───shared
│       ├───engine
│       │   ├───adapters
│       │   ├───core
│       │   ├───evaluation
│       │   ├───extractors
│       │   ├───metrics
│       │   └───pipeline
│       ├───infrastructure
│       │   └───github
│       └───lib
├───shared
│   ├───api
│   │   ├───auth
│   │   │   ├───templates
│   │   │   └───types
│   │   └───schemas
│   ├───constants
│   ├───data
│   ├───hooks
│   ├───lib
│   ├───types
│   └───ui
│       ├───core
│       ├───icons
│       ├───kit
│       └───visuals
├───tests
│   ├───e2e
│   │   └───test-results
│   ├───integration
│   └───unit
└───widgets
    ├───app-footer
    │   └───ui
    ├───app-header
    │   ├───model
    │   └───ui
    ├───app-sidebar
    │   └───ui
    ├───hotkey-manager
    │   ├───model
    │   └───ui
    ├───public-header
    │   └───ui
    └───welcome-flow
        └───ui
