# Development Guide & Quality Standards

This guide outlines the standards and workflows for the Interactive Technical Passport. Adherence is required for all contributions to maintain stability in this monorepo.

## Local Setup & Testing

1. **Install Dependencies:**
   Ensure `bun` is installed. Run the following from the root directory:

   ```bash
   bun install
   ```

2. **Environment Configuration:**
   The server requires environment variables managed via Doppler. To run server tasks locally, use the provided script:

   ```bash
   # Example: Running database migrations
   bun run db:migrate
   ```

3. **Development Servers:**
   Use Turborepo to orchestrate concurrent development:
   - Start all: `bun run dev`
   - Client only: `bun run dev:client`
   - Server only: `bun run dev:server`

4. **Verification:**
   - **Type Checking:** Run `bun run type-check` before submitting any PR.
   - **Linting:** Use `bun run lint` and `bun run format` to ensure code style compliance according to [[biome.json]].

## Pre-Commit Verification Checklist (Fragile Zones)

Before committing, verify changes against these high-risk areas:

- [ ] [[server/src/env.ts]]: Ensure no new environment variables are added without updating the validation schema.
- [ ] [[server/src/db/index.ts]]: Verify connection pooling and Drizzle ORM configuration.
- [ ] [[server/src/client.ts]]: If modifying Hono RPC definitions, ensure the client-side cache remains synchronized.
- [ ] [[client/src/routeTree.gen.ts]]: This file is auto-generated. If you modify routes, ensure the route tree is regenerated correctly.
- [ ] [[server/src/db/schema.ts]]: Any schema change requires a new migration file. Run `bun run db:generate` to verify generated SQL.

## Pre-Commit Security Checks

- **Secrets:** Never commit raw credentials. Always use Doppler for environment secrets.
- **SQL Injection:** Always use the Drizzle ORM query builder. Do not use raw SQL templates unless explicitly reviewed by a maintainer.
- **Data Exposure:** Verify that [[server/src/modules/scan/scan.router.ts]] and other API endpoints strictly adhere to the defined return types in [[shared/src/types/index.ts]].
- **Dependencies:** Regularly audit `bun.lock` and `server/bun.lock` for vulnerabilities.

## PR Quality Standards & Review Gates

- **Documentation:** All new features must include updated comments in the relevant [[server/src/modules/scan/scan.service.ts]] or client components.
- **Testing:** New logic requires tests. Use `bun run test` to verify coverage.
- **Review:** PRs must be approved by a maintainer. Focus on the `dependencyHotspots` identified in the architecture report to ensure changes don't cause cascading failures.
- **Branch Naming:** Use `feat/`, `fix/`, or `refactor/` prefixes followed by a descriptive name (e.g., `feat/add-scan-filter`).

## Change Playbooks

### Adding a New API Filter

1. Define the input type in [[shared/src/types/index.ts]].
2. Update the service logic in [[server/src/modules/scan/scan.service.ts]].
3. Expose the endpoint in [[server/src/modules/scan/scan.router.ts]].
4. Update the frontend query hook in [[client/src/routes/index.tsx]].

### Modifying Database Schema

1. Edit [[server/src/db/schema.ts]].
2. Generate the migration: `bun run db:generate`.
3. Verify the generated file in [[server/src/db/migrations/0000_init_schema.sql]].
4. Apply to local DB: `bun run db:push`.

### Adding a New Route

1. Create/Update the component in the appropriate directory (e.g., [[client/src/routes/]]).
2. Run the development server; the `tanstack-router` plugin will automatically update [[client/src/routeTree.gen.ts]].
3. Verify the route in the UI.
