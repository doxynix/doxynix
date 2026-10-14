---
name: analysis-engine
description: Architecture and design rules for the Doxynix AI repository analysis pipeline, Trigger.dev tasks, Sentinel/Mapper/Architect stages, and documentation generators in apps/web. Use when modifying analysis tasks, AST scanning, writer tasks, or GitHub PR review comment logic.
---

# Doxynix Analysis Engine & AI Pipeline

## Overview
The core engine of Doxynix analyzes codebases via AST parsing and multi-stage LLM synthesis to generate interactive dependency graphs, OpenAPI specs, documentation, and automated PR reviews.

## The Iron Law
```
TOKEN BUDGETS MUST BE DYNAMIC (NO HARDCODING). DOCUMENT SECTIONS MUST ALWAYS ANCHOR TO DEPENDENCY GRAPH NODES.
```

---

## 1. Multi-Stage Pipeline Architecture (`apps/web`)

Background tasks run via **Trigger.dev v4**:
```text
analyzeRepoTask (Trigger.dev, ~20min)
  ├─ Phase 1: Sentinel Detection (AST injection & security findings via web-tree-sitter)
  ├─ Phase 2: Mapper (Project structure, dependency metrics, and graph topology)
  └─ Phase 3: Architect (LLM synthesis, Swagger generation, and living documentation)
         └─ Model tiers: activeModels.POWERFUL → activeModels.ARCHITECT → activeModels.FALLBACK
```

### Core Principles:
1. **Dynamic Token Budget**: Never hardcode prompt token limits. Read `tokenBudget` and `focusAreas` from
   `PRAnalysisConfig` (defined in `logic/pr.types`, persisted via `logic/pr-config.ts`).
2. **Modular Stages**: Each stage must implement the standard interface and be independently runnable (e.g., Sentinel running standalone for PR diffs).
3. **Model Fallback Cascade**: If the primary reasoning model hits rate limits or timeouts, gracefully downgrade to fallback models and log the event.
4. **Context Manager**: Prioritize "hot files" and critical entry points first when assembling context for prompts.

---

## 2. Living Documentation & Graph Synergy

When orchestrating doc writers (exported from `tasks/writer.tasks.ts`): `readmeTask` (`write-readme`),
`apiTask` (`write-api`), `architectureTask` (`write-architecture`), `contributingTask`
(`write-contributing`), `changelogTask` (`write-changelog`):

1. **AST-Driven Facts Only**: Never hallucinate code examples. Every code block must derive from real parsed files.
2. **Graph Anchoring**: Every generated document section MUST include `graphNodeIds` referencing specific nodes in the dependency graph:
```json
{
  "id": "section-auth",
  "title": "Authentication Module",
  "graphNodeIds": ["node-auth-service", "node-oauth-provider"],
  "content": "..."
}
```
3. **Diagrams**: Generate Mermaid diagrams for data flows and component lifecycles.

---

## 3. GitHub PR Differential Review Engine

When running `analyzePrTask`:
1. **Scope Reduction**: Run Sentinel and AST extractors strictly against the diff range (`git diff target...branch`).
2. **Impact Analysis**: Mapper checks if changed interfaces break downstream dependencies.
3. **Comment Posting**:
   - Batch reviews via Octokit (`octokit.rest.pulls.createReview` in `logic/comment-poster.ts`).
     GitHub secondary rate limits apply — if you add a submission loop, throttle it.
   - Findings are keyed by a stable signature (`generateFindingSignature`) so a re-run updates the existing
     thread instead of spamming duplicates. Preserve that behaviour.

---

## Verification & Tasks Checklist
- [ ] New stages implement standard stage interface and register in stage registry.
- [ ] Prompts are tested with sample repositories for token consumption.
- [ ] Background tasks compile cleanly with Trigger.dev v4 types.
- [ ] Run unit tests: `bun --filter @doxynix/web test:unit`. There is no root `with-doppler` script —
      the per-package scripts already wrap Doppler themselves.
- [ ] Background tasks are discovered via `dirs: ["./src/server/**/tasks"]` in `trigger.config.ts`;
      a new task must live at `src/server/modules/<slice>/tasks/<kebab-name>.task.ts`.