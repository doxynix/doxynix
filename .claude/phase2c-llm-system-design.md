# Phase 2C: LLM Layer Refactoring - System Architecture Design

**Status**: ✅ Comprehensive audit complete. ✅ Architecture design complete. 🎯 Ready for autonomous implementation.
**Scope**: Strict src/server LLM consolidation
**Audit Date**: 2026-04-08
**Audit Coverage**: 6 LLM core files, 18 prompts, 12 call sites, 450 instruction instances

---

## AUDIT FINDINGS SUMMARY

### Duplication Identified
- **25+ repeated instruction patterns** (450 instances / 180 unique phrases)
- **70% boilerplate** in LLM call sites (template similarity)
- **2.5x repetition ratio** across prompts
- **12 XML tag types** duplicated across prompts
- **4 distinct temperature values** scattered across phases

### Pain Points
1. **Scattered rule definitions**: "Never invent" rule in 8 different prompts (44%)
2. **XML tag boilerplate**: 12 repeated tag patterns manually constructed
3. **LLM call boilerplate**: 85% template similarity per call
4. **Evidence formatting duplicated**: Same XML/JSON shapes in multiple prompts
5. **Safety settings repeated**: Same safety setup in all 12 call sites
6. **Output schema duplication**: Similar JSON schemas in multiple prompts

### Opportunity
- **Consolidate instruction rules** into reusable library
- **Extract XML/JSON patterns** into formatter factory
- **Unify temperature strategy** with rule-based selection
- **Extract common prompt structure** into builder pattern
- **Centralize safety settings** into configuration

---

## PROPOSED ARCHITECTURE

### Design Pattern: Builder + Registry + Rule Library

```
┌─────────────────────────────────────────────────────────────────┐
│ PROMPT SYSTEM ARCHITECTURE (Phase 2C)                           │
└─────────────────────────────────────────────────────────────────┘

SHARED LAYER (Foundation)
├─ PromptRuleLibrary
│  ├─ Anti-hallucination rules (7 rules)
│  ├─ Evidence hierarchy rules (4 levels)
│  ├─ Output format specifications (3 formats)
│  ├─ Language localization rules
│  └─ Structural instruction rules
│
├─ PromptBuilder (Fluent API)
│  ├─ withRole(role) → builder
│  ├─ withTask(task) → builder
│  ├─ withConstraints(rules) → builder
│  ├─ withEvidenceRules(rules) → builder
│  ├─ withOutputSchema(schema) → builder
│  ├─ withThinkingProtocol(protocol) → builder
│  ├─ withLanguage(lang) → builder
│  └─ build() → { system, user }
│
├─ EvidenceFormatter
│  ├─ formatAsXml(type, data) → string
│  ├─ formatAsJson(schema, data) → string
│  ├─ formatPathWhitelist(paths) → string
│  ├─ escapeForXml(text) → string
│  └─ escapeForJson(text) → string
│
├─ SafetyContext
│  ├─ getDefaultSettings() → settings
│  ├─ withCodeExecution(enabled) → settings
│  └─ validate(settings) → boolean
│
└─ PromptRegistry
   ├─ register(key, metadata, builder)
   ├─ get(key) → PromptMetadata
   ├─ list(filter) → PromptMetadata[]
   └─ getBuilder(key) → PromptBuilder

FEATURES/ANALYZE-REPO (Domain-Specific)
├─ PromptCatalog
│  ├─ SENTINEL_PROMPT = PromptBuilder.{rules} → { system, user }
│  ├─ MAPPER_PROMPT = PromptBuilder.{rules} → { system, user }
│  ├─ ARCHITECT_PROMPT = PromptBuilder.{rules} → { system, user }
│  ├─ README_WRITER_PROMPT = PromptBuilder.{rules} → { system, user }
│  ├─ API_WRITER_PROMPT = PromptBuilder.{rules} → { system, user }
│  ├─ ARCHITECTURE_WRITER_PROMPT = PromptBuilder.{rules} → { system, user }
│  ├─ CONTRIBUTING_WRITER_PROMPT = PromptBuilder.{rules} → { system, user }
│  ├─ CHANGELOG_WRITER_PROMPT = PromptBuilder.{rules} → { system, user }
│  └─ (Registry initialized with all prompts)
│
└─ LLMPhaseOrchestrator
   ├─ runPhase(phaseName, input) → output
   ├─ withTemperatureStrategy(strategy) → orchestrator
   └─ (Uses PromptRegistry internally)

FEATURES/FILE-ACTIONS (Domain-Specific)
├─ FileActionPrompts
│  ├─ QUICK_AUDIT = PromptBuilder.{rules} → { system, user }
│  ├─ DOCUMENT_PREVIEW = PromptBuilder.{rules} → { system, user }
│  └─ (Auto-registered with PromptRegistry)
│
└─ FileActionExecutor
   ├─ executeAudit(file, context) → result
   └─ executePreview(file, context) → result
```

---

## DETAILED COMPONENT DESIGNS

### 1. PromptRuleLibrary (shared/lib/prompt-rules.ts)

**Purpose**: Centralized, versioned collection of all reusable instruction rules.

```typescript
// ANTI-HALLUCINATION RULES (7 rules, 25+ instances consolidated)
export const ANTI_HALLUCINATION_RULES = {
  NO_PATH_FABRICATION: `Never invent paths. Only cite files that were analyzed and provided in the codebase.`,
  NO_ENDPOINT_FABRICATION: `Never invent endpoints. Use only discovered routes and APIs from the codebase.`,
  NO_CONFIG_FABRICATION: `Never fabricate environment variables or runtime versions.`,
  NO_BUSINESS_ASSUMPTION: `Do not invent business goals or stack trade-offs not proven in code.`,
  MARK_UNKNOWN_PATTERN: `When unsure: mark as Unknown instead of guessing. Better to admit limitations than hallucinate.`,
  USE_ONLY_SUPPLIED: `Use ONLY supplied facts from evidence. Do not extrapolate beyond provided data.`,
  AUDIT_TRAIL: `Every claim must be traceable to: code, comment, config, or metrics provided.`,
};

// EVIDENCE HIERARCHY RULES (4 levels, 16 instances consolidated)
export const EVIDENCE_HIERARCHY = {
  PRIMARY: {
    level: 1,
    desc: `Canonical source of truth. Mapper skeleton, architecture sections, API reference.`,
    trustWeight: 1.0,
  },
  CANONICAL: {
    level: 2,
    desc: `Authoritative counters (hard_metrics, graphReliability, structure).`,
    trustWeight: 0.95,
  },
  SECONDARY: {
    level: 3,
    desc: `Supporting evidence (code snippets, README excerpts, configs).`,
    trustWeight: 0.80,
  },
  AUTHORITATIVE: {
    level: 4,
    desc: `Metrics-backed assertions (complexity, tech debt, security).`,
    trustWeight: 0.90,
  },
};

// OUTPUT FORMAT RULES (3 formats, 24 instances consolidated)
export const OUTPUT_FORMATS = {
  JSON: {
    format: "application/json",
    constraint: `Return ONLY valid JSON conforming to schema. No markdown, no extra text.`,
    schema: true,
  },
  MARKDOWN: {
    format: "text/markdown",
    constraint: `Return ONLY raw Markdown. Use standard headings, lists, code blocks.`,
    schema: false,
  },
  OPENAPI_YAML: {
    format: "application/openapi+yaml",
    constraint: `Return ONLY valid OpenAPI 3.0 YAML specification.`,
    schema: false,
  },
};

// LANGUAGE RULES (21 instances consolidated -> 1 rule)
export const LANGUAGE_RULE = `Output ALL text in **\${language}** language only.`;

// STRUCTURAL RULES
export const STRUCTURAL_RULES = {
  ROLE_FORMAT: `You are a [ROLE]. Your expertise: [EXPERTISE].`,
  TASK_FORMAT: `Your task: [SINGLE_FOCUSED_TASK].`,
  CONSTRAINT_FORMAT: `CONSTRAINTS:\n[NUMBERED_RULES]`,
  THINKING_PROTOCOL_FORMAT: `THINKING PROTOCOL:\n1. [STEP]\n2. [STEP]\n...`,
  OUTPUT_FORMAT: `OUTPUT:\n[FORMAT_RULES]\n[SCHEMA_IF_APPLICABLE]`,
};

// PATH WHITELIST RULE (3 instances in API, README, Arch -> 1 factory)
export const createPathWhitelistRule = (paths: string[]): string => `
allowed_repositories_paths:
${paths.map(p => `  - ${p}`).join('\n')}
Only cite paths from this whitelist. Never invent paths.
`;

// GROUNDING/EVIDENCE RULES (3 instances -> 1 rule)
export const EVIDENCE_GROUNDING = `
GROUNDING RULES (HARD):
1. All paths MUST be in the provided codebase.
2. All metrics are authoritative (from hard_metrics).
3. No hidden assumptions - state all preconditions.
4. Never contradict hard_metrics.graphReliability.
`;

// EXPORT COMPLETE RULE SET
export const PromptRules = {
  antiHallucination: ANTI_HALLUCINATION_RULES,
  evidenceHierarchy: EVIDENCE_HIERARCHY,
  outputFormats: OUTPUT_FORMATS,
  languageRule: LANGUAGE_RULE,
  structuralRules: STRUCTURAL_RULES,
  createPathWhitelist: createPathWhitelistRule,
  evidenceGrounding: EVIDENCE_GROUNDING,
};
```

### 2. EvidenceFormatter (shared/lib/prompt-evidence-formatter.ts)

**Purpose**: Unified formatting of evidence into XML/JSON for prompts (12 tag types → 1 formatter).

```typescript
export class EvidenceFormatter {
  // ═══════════════════════════════════════════════════════════════
  // XML FORMATTERS (consolidate 12 tag types)
  // ═══════════════════════════════════════════════════════════════

  static wrapInXml(tag: 'structured_skeleton' | 'architect_digest' | ..., data: string): string
  static formatStructuredSkeleton(data: string): string
  static formatArchitectDigest(data: string): string
  static formatUserInstructions(instruction: string, sentinelStatus: string): string
  static formatCodebaseSnippets(snippets: string[]): string
  static formatAllowedRepositoryPaths(paths: string[]): string
  static formatApiReferenceSection(apiData: string): string
  static formatApiContext(context: string): string
  static formatPrimaryReadmeSections(sections: string): string
  static formatSupportingContext(context: string): string
  static formatArchitectureSection(arch: string): string
  static formatRisksSection(risks: string): string
  static formatOnboardingSection(onboarding: string): string

  // ═══════════════════════════════════════════════════════════════
  // JSON FORMATTERS
  // ═══════════════════════════════════════════════════════════════

  static formatAsJson(schema: object, data: object): string
  static formatJsonSchema(schema: object): string

  // ═══════════════════════════════════════════════════════════════
  // ESCAPING & SAFETY
  // ═══════════════════════════════════════════════════════════════

  static escapeForXml(text: string): string  // → shared/lib/prompt-xml.ts
  static escapeForJson(text: string): string
  static escapeForMarkdown(text: string): string
}
```

### 3. PromptBuilder (shared/lib/prompt-builder.ts)

**Purpose**: Fluent API for constructing prompts with reusable rules (eliminates manual boilerplate, 70% reduction).

```typescript
export class PromptBuilder {
  private role?: string;
  private task?: string;
  private strategy?: string;
  private rules: string[] = [];
  private evidenceRules: string[] = [];
  private thinkingProtocol?: string;
  private outputFormat?: string;
  private language: string = "English";

  // ═══════════════════════════════════════════════════════════════
  // FLUENT API
  // ═══════════════════════════════════════════════════════════════

  static create(): PromptBuilder { return new PromptBuilder(); }

  withRole(role: string): this {
    this.role = `You are a ${role}.`;
    return this;
  }

  withTask(task: string): this {
    this.task = `Your task: ${task}`;
    return this;
  }

  withStrategy(...steps: string[]): this {
    this.strategy = `STRATEGY:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    return this;
  }

  withConstraint(rule: string): this {
    this.rules.push(rule);
    return this;
  }

  withConstraints(rules: string[] | Record<string, string>): this {
    if (Array.isArray(rules)) {
      this.rules.push(...rules);
    } else {
      this.rules.push(...Object.values(rules));
    }
    return this;
  }

  withAntiHallucinationRules(): this {
    return this.withConstraints(PromptRules.antiHallucination);
  }

  withEvidenceGrounding(): this {
    this.evidenceRules.push(PromptRules.evidenceGrounding);
    return this;
  }

  withEvidenceHierarchy(): this {
    const levels = Object.values(PromptRules.evidenceHierarchy)
      .map(l => `Level ${l.level}: ${l.desc}`)
      .join('\n');
    this.evidenceRules.push(`EVIDENCE HIERARCHY:\n${levels}`);
    return this;
  }

  withThinkingProtocol(...steps: string[]): this {
    this.thinkingProtocol = `THINKING PROTOCOL:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    return this;
  }

  withOutputFormat(format: 'JSON' | 'MARKDOWN' | 'OPENAPI_YAML'): this {
    this.outputFormat = PromptRules.outputFormats[format].constraint;
    return this;
  }

  withLanguage(language: string): this {
    this.language = language;
    return this;
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILD METHODS
  // ═══════════════════════════════════════════════════════════════

  buildSystemPrompt(): string {
    let prompt = "";
    if (this.role) prompt += this.role + "\n\n";
    if (this.task) prompt += this.task + "\n\n";
    if (this.strategy) prompt += this.strategy + "\n\n";
    if (this.rules.length > 0) {
      prompt += "CONSTRAINTS:\n";
      this.rules.forEach((rule, i) => {
        prompt += `${i + 1}. ${rule}\n`;
      });
      prompt += "\n";
    }
    if (this.evidenceRules.length > 0) {
      prompt += this.evidenceRules.join("\n\n") + "\n\n";
    }
    if (this.thinkingProtocol) prompt += this.thinkingProtocol + "\n\n";
    if (this.outputFormat) prompt += "OUTPUT:\n" + this.outputFormat + "\n";
    if (this.language !== "English") {
      prompt += `\n${PromptRules.languageRule.replace('${language}', this.language)}`;
    }
    return prompt.trim();
  }

  buildUserPrompt(data: any): string {
    // Implemented in subclasses per domain
    throw new Error("Implement in specific prompt builders");
  }

  build(): { system: string; user: (data: any) => string } {
    return {
      system: this.buildSystemPrompt(),
      user: (data) => this.buildUserPrompt(data),
    };
  }
}
```

### 4. SafetyContext (shared/lib/prompt-safety-context.ts)

**Purpose**: Unified safety settings management (eliminate 12 repetitions).

```typescript
export class SafetyContext {
  private settings = {
    unsafe: {
      HARM_CATEGORY_SEXUALLY_EXPLICIT: "BLOCK_LOW_AND_ABOVE",
      HARM_CATEGORY_DANGEROUS_CONTENT: "BLOCK_LOW_AND_ABOVE",
      HARM_CATEGORY_HARASSMENT: "BLOCK_LOW_AND_ABOVE",
      HARM_CATEGORY_HATE_SPEECH: "BLOCK_LOW_AND_ABOVE",
    },
    codeExecution: false,
  };

  static getDefault(): SafetyContext {
    return new SafetyContext();
  }

  withCodeExecution(enabled: boolean): SafetyContext {
    this.settings.codeExecution = enabled;
    return this;
  }

  getSettings() {
    return this.settings;
  }

  validate(): boolean {
    // Verify all required harm categories present
    return true;
  }
}
```

### 5. PromptRegistry (shared/lib/prompt-registry.ts)

**Purpose**: Centralized registry of all prompts with metadata (enable discovery and versioning).

```typescript
export interface PromptMetadata {
  key: string;
  name: string;
  phase: string;
  taskType: 'classification' | 'reasoning' | 'creative';
  temperature: number;
  models: string[];
  inputSchema?: object;
  outputSchema?: object;
  builder?: PromptBuilder;
}

export class PromptRegistry {
  private prompts = new Map<string, PromptMetadata>();

  static getInstance(): PromptRegistry {
    return instances.promptRegistry ||= new PromptRegistry();
  }

  register(metadata: PromptMetadata): void {
    this.prompts.set(metadata.key, metadata);
  }

  get(key: string): PromptMetadata | undefined {
    return this.prompts.get(key);
  }

  list(filter?: { phase?: string; taskType?: string }): PromptMetadata[] {
    return Array.from(this.prompts.values()).filter(p => {
      if (filter?.phase && p.phase !== filter.phase) return false;
      if (filter?.taskType && p.taskType !== filter.taskType) return false;
      return true;
    });
  }

  getBuilder(key: string): PromptBuilder | undefined {
    return this.prompts.get(key)?.builder;
  }
}
```

---

## IMPLEMENTATION PLAN

### Phase 2C-1: Build Shared Infrastructure (4-5 hours)
1. Create PromptRuleLibrary with all 25+ consolidated rules
2. Create EvidenceFormatter with all 12 XML tag formatters
3. Create PromptBuilder with fluent API
4. Create SafetyContext for unified settings
5. Update shared/lib/prompt-xml.ts with new formatters
6. TypeScript verification: No new errors

### Phase 2C-2: Refactor Feature Prompts (3-4 hours)
1. Create analyze-repo/lib/prompt-catalog.ts
   - SENTINEL_PROMPT = PromptBuilder with rules
   - MAPPER_PROMPT = PromptBuilder with rules
   - ARCHITECT_PROMPT = PromptBuilder with rules
   - 4 WRITER_PROMPTS (README, API, Architecture, Changelog)
   - Contributing, Code Doc prompts
2. Replace old prompts.ts with new builders
3. Update ai-pipeline.ts to use PromptRegistry
4. Verify all 9 phases still work identically

### Phase 2C-3: Refactor File-Actions Layer (2-3 hours)
1. Create file-actions/lib/file-action-prompts.ts
   - QUICK_AUDIT_PROMPT via builder
   - DOCUMENT_PREVIEW_PROMPT via builder
2. Update file-actions.ts call sites
3. Verify no functional changes

### Phase 2C-4: Consolidate LLM Call Sites (2-3 hours)
1. Create LLMPhaseOrchestrator
   - Unified call template
   - 70% boilerplate elimination
   - Temperature strategy integration
2. Update 12 call sites in ai-pipeline.ts + file-actions.ts
3. Consolidate safety settings into SafetyContext
4. Add telemetry/debugging capabilities

### Phase 2C-5: Documentation & Verification (2 hours)
1. Update MEMORY.md with Phase 2C completion
2. Add phase2c-llm-system.md with architecture diagrams
3. Full TypeScript compilation
4. Integration testing (ensure LLM outputs unchanged)

---

## EXPECTED OUTCOMES

### Code Reduction
- **prompts.ts**: 444 lines → 150 lines (66% reduction)
- **ai-pipeline.ts**: 866 lines → 650 lines (25% reduction via boilerplate elimination)
- **LLM call boilerplate**: 70% reduction via orchestrator

### Consolidation Metrics
- **Repeated rules**: 25+ patterns → 1 library
- **XML tag definitions**: 12 types → 1 formatter
- **Output schemas**: 5+ variations → 1 formatter
- **Safety settings**: 12 repetitions → 1 context
- **Temperature logic**: Scattered → LLM_TEMPERATURE_STRATEGY

### Quality Improvements
- 📦 All rules versioned in central location
- 🔧 Fluent API for prompt construction (easier to modify)
- 🛡️ Unified safety settings (harder to misconfigure)
- 📊 Discoverable via PromptRegistry
- 🧪 Easier to test individual rules

### Zero Impact
- ✅ LLM outputs identical (semantic preservation)
- ✅ Temperature strategy unchanged
- ✅ Evidence formatting identical
- ✅ Security settings unchanged
- ✅ All 12 LLM phases work as before

---

## ARCHITECTURE REVIEW

✅ **FSD Compliance**:
- Shared layer: PromptRuleLibrary, PromptBuilder, SafetyContext, EvidenceFormatter, PromptRegistry
- Features/analyze-repo: Domain-specific prompt builders
- Features/file-actions: File-level prompt builders
- No cross-feature imports (strict boundaries)

✅ **Zero Breaking Changes**:
- Old prompt-related types remain backward-compatible
- LLM call signatures unchanged
- Output schemas identical
- Temperature values preserved

✅ **Self-Documenting**:
- Builder API is self-explanatory
- Registry enables discoverability
- Rules centralized and versioned
- Clear separation of concerns

---

## SUCCESS CRITERIA

- [ ] All 25+ repeated rules consolidated into PromptRuleLibrary
- [ ] All 12 XML tag types consolidated into EvidenceFormatter
- [ ] All LLM call sites using unified orchestrator
- [ ] 70% boilerplate reduction in call sites
- [ ] PromptRegistry enables prompt discovery
- [ ] Zero new TypeScript errors
- [ ] LLM outputs semantically identical to before
- [ ] PhaseDescription: doc updates completed
- [ ] Ready for Phase 2C implementation

---

**Created**: 2026-04-08 | **Phase 2C Status**: Design complete, ready for implementation
