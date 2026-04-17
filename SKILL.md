# Backend Engineering Skills for Doxynix

## Skill 1: AI Pipeline Design & Refinement
**When**: Building/fixing analysis stages (Sentinel→Mapper→Architect)

### Current Pipeline Structure
```
analyzeRepoTask (Trigger.dev, ~20min)
  ├─ Phase 1: Sentinel Detection (AST injection finding)
  ├─ Phase 2: Mapper (project structure + metrics)
  └─ Phase 3: Architect (LLM synthesis + swagger generation)
         └─ Fallback model chain: POWERFUL → ARCHITECT → FALLBACK
```

### Principles
1. **Token Budget as First-Class Config**: Don't hardcode 210K for architect phase. Use `ArchitectConfig { tokenBudget, focusAreas, modelChain }`
2. **Modular Stages**: Each stage is reusable (e.g., Sentinel used alone for PR diff analysis)
3. **Prompt Engineering**: Prompts in `src/server/features/analyze-repo/lib/prompts-refactored.ts`. Update carefully—test with real repos.
4. **Fallback Strategy**: If POWERFUL fails (quota/rate limit), cascade to ARCHITECT, then FALLBACK model. Log each fallback.
5. **Context Management**: Use `ContextManager` to intelligently select files based on token budget + file importance (hot files first).

### Adding New Analysis Stage
1. Create file in `src/server/features/analyze-repo/model/stages/`
2. Implement `AnalysisStage` interface (input, output, execute)
3. Register in `stage-registry.ts` (enable composition)
4. Add prompt template in `prompts-refactored.ts`
5. Update AI pipeline orchestrator to include new stage
6. Test with sample repos + verify token usage

---

## Skill 2: GitHub Integration & PR Generation
**When**: Building PR automation, comment posting, OAuth flows

### Current GitHub Capabilities
- **OAuth**: User sign-in + refresh token rotation
- **GitHub App**: Installation management (org/user repos)
- **Token Resolution**: Fallback chain (app token → user token → public access)
- **Webhook Handling**: Installation events (create/suspend/delete)

### Adding PR Analysis & Comment Posting

**Step 1: Webhook Event Handler**
```
POST /api/webhooks/github
  → filter event_type === 'pull_request'
  → extract owner, repo, PR number, changed_files
  → Create PullRequestAnalysis record (PENDING)
  → Trigger analyze-pr task
```

**Step 2: Differential Analyzer** (in `src/server/features/pr-analysis/`)
```
analyzeProTask (Trigger.dev, ~5min for massive PRs)
  ├─ Fetch PR diff (git diff master...branch)
  ├─ Extract changed files + line ranges
  ├─ Run Sentinel phase on changed code only
  ├─ Run Mapper on dependency impact (did we break interfaces?)
  ├─ Run Architect phase with smaller token budget (30-50K)
  └─ Generate findings: risks, suggestions, code snippets
```

**Step 3: Comment Posting Engine**
```
postPRComments(findings, owner, repo, prNumber):
  ├─ Batch findings by file
  ├─ For each changed line:
  │  └─ Octokit.rest.pulls.createReview({
  │       pull_number, commit_id, path, line,
  │       body: formattedFinding
  │     })
  ├─ Cache comment IDs in PullRequestComment model
  └─ If PR updated → update existing comments
```

**Step 4: Configuration Model**
```
Repo.prAnalysisConfig = {
  enabled: boolean,
  token_budget: number (default 30000),
  focus_areas: string[] (e.g., ["security", "performance", "style"]),
  comment_style: "detailed" | "concise" | "off"
}
```

### Rate Limiting & Reliability
- Cache GitHub token resolution (avoid repeated app token fetches)
- Implement circuit breaker for GitHub API (auto-backup if quota exceeded)
- Batch comment operations (max 1 review per PR per minute to avoid rate limits)
- Use exponential backoff for API retries

---

## Skill 3: Documentation Generation Orchestration
**When**: Modifying writers, prompts, or documentation structure

### Current Doc Generation Flow
```
generateDeepDocs() orchestrateWriterTasks():
  ├─ writer_readme.task       → Project overview, quick start
  ├─ writer_api.task          → OpenAPI/Swagger from Architect findings
  ├─ writer_architecture.task → Dependency graph, design decisions
  ├─ writer_changelog.task    → Recent changes, breaking changes
  ├─ writer_code_doc.task     → Code comments, inline docs
  └─ writer_contributing.task → Contributing guide, setup
```

### Principles for Rich Documentation
1. **AST-Driven Content**: Extract real code examples from analysis. Don't generate fictional examples.
2. **Flow Diagrams**: Include data flow + component interaction diagrams (text-based Mermaid)
3. **Onboarding Paths**: Map "first time reading" → "learning path" based on architecture complexity
4. **Links to Graph**: Every section should have anchor to dependency node (e.g., `#component-auth-service`)

### Linking Documentation to Graph (Synergy)
Backend response structure:
```json
{
  "documents": [
    {
      "type": "ARCHITECTURE",
      "sections": [
        {
          "id": "section-auth",
          "title": "Authentication Module",
          "graphNodeIds": ["node-auth-service", "node-oauth-provider"],
          "content": "..."
        }
      ]
    }
  ]
}
```

Frontend can use `graphNodeIds` to highlight relevant nodes when scrolling docs.

### Adding New Writer
1. Create file in `src/server/features/analyze-repo/model/writers/`
2. Implement `DocWriter` interface (input analysis, output document)
3. Register in `writer-orchestrator.ts`
4. Define prompt template in `prompts-refactored.ts`
5. Add Document type constant + type to schema.zmodel

---

## Skill 4: Database & Schema Management
**When**: Adding new models or modifying existing relationships

### Schema File Location
**NEVER edit**: `prisma/schema.prisma` (autogenerated)  
**ALWAYS edit**: `prisma/schema.zmodel` (ZenStack source of truth)

### Generation & Migration
```bash
# Generate Prisma client + Zod
pnpm db:generate

# Apply migration to local DB
pnpm db:migrate

# Interactive studio (inspect data)
pnpm db:studio
```

### Model Pattern (FSD)
```typescript
// src/server/entities/my-entity/api/my-entity.service.ts
import { prisma } from '@/server/shared/lib/prisma'

export const myEntityService = {
  create: async (input: CreateInput) => {
    return prisma.myEntity.create({ data: input })
  },
  // ...
}
```

### ZenStack Access Control
Define in `schema.zmodel`:
```
model MyEntity {
  id String @id
  userId String
  user User @relation(fields: [userId], references: [id])
  
  // Access control (run-time checking)
  @@allow('create,read,update', auth().id == userId)
  @@allow('delete', auth().role == 'ADMIN')
}
```

---

## Skill 5: Error Handling & Logging
**When**: Building API endpoints, background tasks, integrations

### Structured Logging (logger from shared)
```typescript
import { logger } from '@/server/shared/lib/logger'

logger.info('repo_analysis_started', {
  repoId,
  repoUrl,
  userId,
  context: { phase: 'sentinel' }
})

logger.error('github_api_failed', {
  error: err.message,
  code: err.code,
  statusCode: err.statusCode,
  context: { owner, repo }
})
```

### Error Response Pattern (tRPC)
```typescript
import { TRPCError } from '@trpc/server'

export const analyzeRouter = createRouter()
  .mutation('analyze', async ({ input, ctx }) => {
    try {
      // logic
    } catch (err) {
      if (err instanceof GitError) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Repository clone failed',
          cause: err
        })
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Analysis failed unexpectedly'
      })
    }
  })
```

### Circuit Breaker (GitHub API reliability)
```typescript
import { CircuitBreaker } from '@/server/shared/lib/circuit-breaker'

const githubBreaker = new CircuitBreaker({
  threshold: 5,           // 5 failures
  timeout: 60_000,        // 60s open state
  onOpen: () => logger.warn('github_api_circuit_open')
})

export const getRepoInfo = githubBreaker.execute(async () => {
  return octokit.repos.get({ owner, repo })
})
```

---

## Skill 6: Testing (BACKEND ONLY - No frontEnd tests)

### Test Structure
```
src/tests/
├─ unit/              # Pure function tests (no I/O)
├─ integration/       # Tests with real DB + mocks
└─ e2e/               # Trigger.dev tasks + webhook flows (Playwright for UI only)
```

### Running Tests
```bash
pnpm test:unit        # Vitest (fast)
pnpm test:int         # Integration (with real DB snapshot)
pnpm test:e2e         # Playwright (UI flows only)
```

### Example Backend Unit Test
```typescript
import { describe, it, expect } from 'vitest'
import { calculateBusFactor } from '@/server/shared/engine/metrics/bus-factor'

describe('calculateBusFactor', () => {
  it('should return 1 for single author', () => {
    const result = calculateBusFactor([{ author: 'alice', commits: 100 }])
    expect(result).toBe(1)
  })
})
```

---

## Skill 7: Code Generation & Type Safety
**When**: Working with OpenAPI, Zod schemas, or code generation

### Zod Schema Generation
```bash
# Generates src/generated/zod/ from schema.zmodel
pnpm db:generate

# Use in validation
import { CreateRepoInput } from '@/generated/zod/repo'

const result = CreateRepoInput.parse(userInput)
```

### OpenAPI Client Generation
```bash
# Generates Axios client from OpenAPI spec
pnpm gen:client

# Use in server-to-server calls
import { apiClient } from '@/generated/api-client'

const response = await apiClient.repos.list()
```

### TypeDocs Generation
```bash
pnpm doc:gen
# Generates public/docs/ with full API documentation
```

---

## Skill 8: Project Architecture Validation
**When**: Refactoring, moving files, or checking boundaries

### Dependency Check
```bash
# Dump all dependencies into text format
pnpm arch:dump
# Output: arch/dependencies_list.txt

# Validate no violations
pnpm arch:check
```

### Common Violations to Avoid
- ❌ Importing from `features` into `shared`
- ❌ Importing from `app` layer into `widgets`
- ❌ Circular dependencies between features
- ❌ Importing from `ui` into `model` (wrong direction)

---

## Skill 9: Environment & Deployment
**When**: Managing secrets, setting up CI/CD, deployment configs

### Secret Management
```bash
# Check for hardcoded secrets
pnpm secretlint

# Use environment variables
process.env.GITHUB_APP_ID      // Loaded from .env.local
process.env.DATABASE_URL       // Set by deployment platform
```

### Deployment Checklist
- [ ] All secrets in environment variables (NEVER in code)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm arch:check` passes
- [ ] Database migrations applied (`pnpm db:migrate`)
- [ ] Build succeeds (`pnpm build`)

---

## Quick Reference Commands

```bash
# Development
pnpm dev                  # Start dev server + Trigger.dev

# Code Quality
pnpm lint:fix            # Auto-fix ESLint
pnpm format              # Prettier format
pnpm typecheck           # TypeScript check
pnpm secretlint          # Check for secrets
pnpm arch:check          # Validate FSD boundaries

# Database
pnpm db:generate         # Generate Prisma + Zod
pnpm db:migrate          # Apply migrations
pnpm db:studio           # Interactive DB browser

# Code Generation
pnpm gen:client          # Generate OpenAPI client
pnpm doc:gen             # Generate TypeDocs

# Testing
pnpm test:unit           # Unit tests
pnpm test:int            # Integration tests
pnpm test:e2e            # E2E tests (Playwright)

# Production
pnpm build               # Build for production
pnpm start               # Start production server
```

---

## Design Philosophy: "Living Backend"

The backend is not a database API. It's a **proactive AI assistant** that:

1. **Anticipates Issues**: Detects problems (complexity, security, architecture) before humans report them
2. **Proposes Solutions**: Generates actionable diffs, not just warnings
3. **Opens PRs**: Autonomously commits fixes and creates pull requests
4. **Explains Decisions**: Documentation is rich, linked to code, and navigable
5. **Learns Context**: Respects repo configuration, team conventions, and previous decisions

This philosophy guides all design decisions.
