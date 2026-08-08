# System Identity & Onboarding Blueprint

## Executive Summary

The Interactive Technical Passport is a full-stack, type-safe security information and event management (SIEM) log intelligence system. It provides real-time anomaly detection for sensitive data leaks (e.g., credit card patterns) within logs. The system utilizes a monorepo architecture, leveraging **Bun** for orchestration, **Hono** for high-performance API services, **Drizzle** for database interactions, and **React** with **TanStack Query** for a responsive, data-driven frontend. Its core value proposition is maintaining end-to-end type safety between the server API surface and the client interface, ensuring robust data handling for security analysts.

## Primary Entrypoints

* [[server/src/index.ts]]: The primary API entrypoint. Defines the Hono application, middleware stack (CORS, CSRF, logging), and core business logic for log scanning.
* [[client/src/routes/index.tsx]]: The main frontend route. Serves as the primary interface for triggering log scans and displaying findings via TanStack Query.
* [[server/src/db/index.ts]]: The database access layer. Configures the Drizzle ORM instance and schema bindings used across the backend.
* [[client/src/routeTree.gen.ts]]: The auto-generated routing manifest. Essential for understanding the application's navigation structure and component tree.
* [[shared/src/types/index.ts]]: The central source of truth for shared data contracts (e.g., `LeakFinding`, `ScanResult`), ensuring consistency between the server and the client.

## Knowledge Holders & Ownership Risks

* **Engineering Team**: The codebase is maintained as a collective monorepo.
* **Ownership Risks**: High bus-factor risk is associated with the configuration-heavy setup (e.g., [[turbo.json]], [[biome.json]], and the `bun` workspace orchestration). Changes to these files can disrupt the entire build pipeline. The reliance on auto-generated files like [[client/src/routeTree.gen.ts]] requires strict adherence to the defined build lifecycle to avoid desynchronization.

## Quick Start, Setup & Verification

### Prerequisites

* [Bun](https://bun.sh) runtime (v1.2.4 or higher).
* Access to the repository.

### Setup Instructions

1. **Install Dependencies**: Navigate to the project root and run:

    ```bash
    bun install
    ```

2. **Environment Configuration**: Ensure required environment variables are defined. The server requires access to a database (via `DATABASE_URL`) and an Axiom token (via `AXIOM_TOKEN`). Refer to [[server/src/env.ts]] for the schema.
3. **Database Migration**: Initialize the local database schema:

    ```bash
    bun run db:migrate
    ```

4. **Launch Development Environment**: Start the monorepo services:

    ```bash
    bun run dev
    ```

### Smoke Test / Verification

Verify the server is operational by pinging the health endpoint:

```bash
curl http://localhost:3000/api/ping
```

> [!NOTE]
> The expected response is `{"status":"ok","message":"pong"}`.

## Operating Model & Next Steps

The system operates as a workspace-based monorepo orchestrated by **Turbo**. The server runtime utilizes Hono's `fetch` API, enabling deployment in edge or Node-compatible environments. The frontend relies on Vite's HMR and TanStack Router's file-based routing.

### Next Steps for Engineers

* Review [[server/src/modules/scan/scan.service.ts]] to understand the core detection logic.
* Consult [[client/src/shared/lib/utils.ts]] for standard UI patterns and Tailwind configurations.
* Examine [[server/src/db/schema.ts]] for the current data model definitions before performing schema modifications.
* Read [[client/README.md]] and [[server/README.md]] for environment-specific deployment details.

> [!WARNING]
> Do not manually edit [[client/src/routeTree.gen.ts]]. Use the TanStack Router CLI or standard build tasks to regenerate this file.
