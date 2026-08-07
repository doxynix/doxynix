---
name: hono-rpc-endpoint
description: Step-by-step workflow for creating an end-to-end type-safe Hono RPC API endpoint with Zod input validation.
---

# Hono RPC Endpoint Creation

When implementing a new API endpoint in the SIEM system, strictly adhere to the VSA module layout.

## Step 1: Define Zod Schema (server/src/modules/<name>/<name>.schema.ts)

Define schema using Zod for payload validation:
- Import z from "zod".
- Export request schema and infer type via z.infer.

## Step 2: Implement Business Logic (server/src/modules/<name>/<name>.service.ts)

Implement domain logic using Drizzle ORM from @server/core/db/db.

## Step 3: Define Hono Router (server/src/modules/<name>/<name>.router.ts)

- Use zValidator from @hono/zod-validator to parse JSON payloads.
- Protect routes with requireAuth from @server/core/middleware/auth.middleware.

## Step 4: Mount Router in server/src/index.ts

Mount the router using basePath /api and export AppType for client-side consumption.

## Step 5: Consume on Client via hcWithType

Invoke the endpoint using hcWithType from @doxynix/siem-server/client without manual fetch calls.