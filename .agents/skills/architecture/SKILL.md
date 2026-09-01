---
name: architecture
description: Rules and verification procedures for Feature-Sliced Design (Client) and Vertical Slice Architecture (Server).
---

# FSD / VSA Architecture Compliance

The SIEM repository enforces strict import boundary checks. Architectural violations will fail pre-commit hooks configured in lefthook.

## Run Architecture Verifier:

Execute the check script against modified files:
`bun scripts/arch-check.ts client/src/features/my-feature/index.tsx`

## Core Architectural Rules:

### Client Layer (Feature-Sliced Design):
1. Forbidden Cross-Feature Imports:
   - Features cannot import other features. Move shared logic down to entities/ or shared/.

2. Layer Hierarchy Order:
   - Order: shared -> entities -> features -> widgets -> routes.
   - shared CANNOT import from entities, features, widgets, or routes.
   - entities CANNOT import from features, widgets, or routes.

3. Client-Server Isolation:
   - No direct backend imports inside client components.
   - Import shared interfaces from @doxynix/shared or RPC definitions from server/src/client.

### Server Layer (Vertical Slice Architecture):
1. Modules in server/src/modules/A MUST NOT directly import private implementation details of server/src/modules/B. Shared utilities belong in server/src/core/.