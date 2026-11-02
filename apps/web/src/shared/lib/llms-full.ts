import { buildLlmsUrl } from "./llms";

export function buildLlmsFullTxt(baseUrl: string): string {
  const site = (href: string, fragment = "") => buildLlmsUrl(baseUrl, href, fragment);

  return `# Doxynix — full context

This file is a self-contained description of Doxynix for language models and coding agents. It is generated at build time from the same source as ${site("llms.txt")}.

## What Doxynix is

Doxynix is a hosted service that turns an existing Git repository into up-to-date documentation. It combines AST parsing (exact structure: files, modules, functions, parameters, imports, dependency edges) with LLM explanations (what the code does and why). Anchoring the model in real symbols keeps generated text from drifting into plausible-sounding guesses.

It is built for teams inheriting legacy code, onboarding new engineers, and keeping documentation from going stale.

## How an analysis runs

1. Connect a repository through the GitHub App, or add it with \`dxnx repos add <url>\`.
2. Doxynix clones the repository into an ephemeral container.
3. The AST scanner builds the structural model: files, modules, symbols, imports, dependency edges.
4. The LLM stage writes documentation for the selected nodes using that structural context.
5. Metrics are computed: documentation coverage, cyclomatic complexity, maintainability index, Bus Factor.
6. Artifacts are stored and streamed to the dashboard in real time.
7. The container and the cloned code are destroyed. Source code is not used to train models.

## Generated documents

| Type | What it contains |
| --- | --- |
| README | Repository overview, setup and architecture summary |
| ARCHITECTURE | Modules, data flow and dependency map |
| API | Endpoint reference in Swagger/OpenAPI style |
| CHANGELOG | Diff-driven release history |
| CONTRIBUTING | Contribution and review workflow |
| CODE_DOC | Per-file documentation for individual source files |

Outputs can be exported as Markdown, PDF, Notion pages or a static site, and can be refreshed from CI with the CLI or the GitHub Action.

## Metrics

- Documentation coverage: share of public symbols with usable documentation.
- Cyclomatic complexity: branching density per function.
- Maintainability index: composite health score for a module.
- Bus Factor: how much of the codebase depends on knowledge held by too few people.

## Plans and limits

| Plan | Price | Analyses per month | AI tokens per month | Private repositories | Pull request reviews | History |
| --- | --- | --- | --- | --- | --- | --- |
| Hobby | Free | 20 | 1,000,000 | No | No | 7 days |
| Pro | Per seat, billed monthly in USD | 500 | 20,000,000 | Yes | Yes | 90 days with auto-resync |
| Team | Custom, sales-led | Unlimited | Unlimited | Yes | Yes | Unlimited |

Hobby is limited to one workspace member. The current Pro price is shown on ${site("", "#pricing")}.

## CLI

The \`dxnx\` CLI is the primary integration surface for CI/CD. Most commands accept \`--json\` for machine-readable output.

- Auth: \`dxnx auth login\`, \`dxnx auth logout\`, \`dxnx auth me\`.
- Repositories: \`dxnx repos list\`, \`dxnx repos add <url>\`, \`dxnx repos view <target>\`.
- Analysis: \`dxnx analyze start [target]\`, \`dxnx analyze status [target]\`, \`dxnx analyze cancel [analysisId]\`, \`dxnx analyze history [target]\`.
- Inspection: \`dxnx analyze metrics [target]\`, \`dxnx analyze structure [target]\`, \`dxnx analyze search <query> [target]\`, \`dxnx analyze audit <filePath>\`.
- Configuration: \`dxnx analyze config [target]\`, \`dxnx analyze config-set [target]\`.
- Documents: \`dxnx docs list\`, \`dxnx docs view\`, \`dxnx docs generate <filePath>\`, \`dxnx docs pin <filePath>\`, \`dxnx docs export\`.
- Pull requests: \`dxnx pr list\`, \`dxnx pr comments\`, \`dxnx pr fixes\`, \`dxnx pr fix-apply\`.

## API and MCP

- API keys are issued in the dashboard under Settings, API keys, and are scoped to a workspace.
- The Model Context Protocol endpoint lives at ${site("api/mcp")} and exposes the analysis agent as tools. Authenticate with a Doxynix API key.

## Security and data handling

- Analysis runs in ephemeral containers; cloned code is deleted immediately after the run.
- Source code is never used to train models; the model provider is used under a zero data retention policy.
- Repositories, API keys and generated artifacts are scoped to a workspace, and access is enforced server-side.

## FAQ

**Is my code safe?** Yes. Analysis happens in ephemeral containers, the code is deleted right after the run, and it is not used for training.

**How accurate is the documentation?** AST parsing supplies the exact structure (names, parameters, relationships); the LLM only explains logic on top of it, which keeps hallucinations low.

**Can I run this in CI/CD?** Yes. Use the \`dxnx\` CLI or the GitHub Action to refresh documentation on every merge to the main branch.

**Does it work with legacy code?** Yes. Bus Factor and complexity metrics surface the undocumented, high-risk modules first.

**What metrics are generated?** Documentation coverage, cyclomatic complexity, maintainability index and Bus Factor.

## Links

- [Product](${site("")})
- [How it works](${site("about")})
- [Pricing](${site("", "#pricing")})
- [Documentation](${site("https://docs.doxynix.space")})
- [Support](${site("support")})
- [Status](${site("https://status.doxynix.space")})
- [GitHub](${site("https://github.com/doxynix/doxynix")})
- [MCP server](${site("api/mcp")})
- [Privacy Policy](${site("privacy")})
- [Terms of Service](${site("terms")})
`;
}
