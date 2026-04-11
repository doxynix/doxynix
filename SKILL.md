---
name: web
description: Commands and workflows for Database, Testing, and Code Generation.
---

# Skills & Runbooks

## Skill 1: Database & Backend Changes
Whenever you need to change the database schema or add models:
1. DO NOT edit `schema.prisma`. Edit `prisma/schema.zmodel` instead.
2. After editing, generate the client and APIs:

pnpm db:generate
If applying to local DB, run:

pnpm db:migrate

Verify data via pnpm db:studio.

Skill 2: Writing & Running Tests

When adding new features or fixing bugs, run the appropriate test suite:

Unit tests: pnpm test:unit

Integration tests: pnpm test:int

E2E (Playwright): pnpm test:e2e

Rule: Keep the whole test suite green. If tests fail, fix them before proceeding.

Skill 3: Code Generation & OpenAPI

If working with external APIs or generating docs:

Update Client API: pnpm gen:client (Parses OpenAPI to Axios).

Generate typedocs: pnpm doc:gen.

Skill 4: Project Context Extraction

If you need to understand dependencies or code structure, do not guess. Run:

# To dump current architecture dependencies into a text file for reading:
pnpm arch:dump
cat arch/dependencies_list.txt
