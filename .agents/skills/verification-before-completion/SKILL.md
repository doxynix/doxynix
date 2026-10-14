---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## Overview

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## Gates that are easy to forget

- **After `bun install` run `bun run clean:symlinks`.** It removes a circular `tree-sitter-wasms`
  symlink that otherwise breaks WASM grammar loading. `postinstall` does this, but CI's
  `bun install --ignore-scripts` does not.
- **`bun run validate` covers locales too** (`lint:i18n` + `lint:locales` across all 12 locales).
  New user-facing copy must be added to every file in `messages/`, not just `en.json`.
- **`bun run knip`** for dead code and **`bun run dup`** for duplication (fails over 5%).
- **`apps/*` must not import each other.** The one deliberate exception: `packages/cli` imports
  `type { AppRouter } from "@doxynix/web/trpc"` — types only, via a devDependency. Never at runtime.
- **Import boundaries are gated by `arch:check`** against a known-violations baseline: new
  violations fail, old ones do not. After a deliberate refactor refresh it with
  `bun --filter @doxynix/<app> arch:baseline` and review the diff.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Commands for this repository

Bun only — `npm` / `yarn` / `pnpm` are prohibited and the permission hook rejects them.

| Claim | Command |
|-------|---------|
| Everything is green | `bun run validate` (Biome + Oxlint + `lint:fsd` + `lint:i18n` + `lint:locales` + `arch:check` + `type-check`) |
| Tests pass | `bun run test` (unit); `bun --filter @doxynix/web test:unit` for a single app |
| Types are correct | `bun run type-check` (`apps/web` is memory-heavy, keep `NODE_OPTIONS=--max-old-space-size=8192`) |
| Import boundaries hold | `bun run arch:check` |
| No duplication | `bun run dup` (fails over 5%) |
| No dead code | `bun run knip` |
| Spelling / secrets | `bun run spellcheck` · `bun run secretlint` |

`bun run validate` transitively runs `db:generate`, which goes through Doppler — locally the
Doppler CLI must be installed and logged in. `scripts/doppler.ts` passes through when `CI=true`.

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion ≠ excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**
```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**Agent delegation:**
```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust agent report
```

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness
