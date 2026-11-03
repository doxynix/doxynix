import { DEFAULT_LOCALE } from "@/shared/config/locales";

import { getSitemapUrl } from "./sitemap.utils";

export const LLMS_CONTENT_TYPE = "text/plain; charset=utf-8";

export type LlmsEntry = {
  description: string;
  fragment?: string;
  href: string;
  title: string;
};

export type LlmsSection = {
  entries: LlmsEntry[];
  title: string;
};

const HEADER = `# Doxynix

> Doxynix turns an existing codebase into up-to-date documentation: it parses the AST for exact structure, uses LLMs to explain logic, and generates onboarding guides, architecture maps, API references and changelogs.

Doxynix works with any Git repository and ships as a web app, a CLI (\`dxnx\`), a GitHub Action and an MCP server. Analysis runs in ephemeral containers under a zero data retention policy: source code is never used to train models. Outputs: Markdown, PDF and Notion exports, plus pull-request sync. It also tracks documentation density, cyclomatic complexity and Bus Factor.`;

export const LLMS_SECTIONS: LlmsSection[] = [
  {
    entries: [
      {
        description:
          "Product overview: what Doxynix generates, how the AST + LLM pipeline works, supported output formats and plans.",
        href: "",
        title: "Doxynix",
      },
      {
        description:
          "How AST parsing is combined with LLM generation, and why the output does not drift from the code.",
        href: "about",
        title: "How it works",
      },
      {
        description:
          "Hobby is free for public repositories (20 analyses per month). Pro adds private repositories, pull request reviews and 90-day history.",
        fragment: "#pricing",
        href: "",
        title: "Pricing",
      },
    ],
    title: "Product",
  },
  {
    entries: [
      {
        description: "Full product and CLI documentation.",
        href: "docs",
        title: "Doxynix Docs",
      },
      {
        description: "Every dxnx command, its arguments and options.",
        href: "docs/cli/reference",
        title: "CLI reference",
      },
      {
        description: "GitHub Action that triggers a repository analysis from CI.",
        href: "https://github.com/doxynix/action",
        title: "Doxynix GitHub Action",
      },
      {
        description:
          "Model Context Protocol endpoint that exposes the analysis agent as tools; requires a Doxynix API key.",
        href: "api/mcp",
        title: "MCP server",
      },
      {
        description: "Source code, releases and issue tracker.",
        href: "https://github.com/doxynix/doxynix",
        title: "GitHub repository",
      },
    ],
    title: "Documentation and integration",
  },
  {
    entries: [
      {
        description: "Contact channels, including email and community links.",
        href: "support",
        title: "Support",
      },
      {
        description: "Bug reports and feature requests.",
        href: "https://github.com/doxynix/doxynix/issues",
        title: "GitHub Issues",
      },
      {
        description: "Community chat for questions and feedback.",
        href: "https://discord.gg/doxynix",
        title: "Discord",
      },
      {
        description: "Uptime and incident history.",
        href: "https://status.doxynix.space",
        title: "Status",
      },
    ],
    title: "Support",
  },
  {
    entries: [
      {
        description: "What data is stored, for how long, and how deletion works.",
        href: "privacy",
        title: "Privacy Policy",
      },
      {
        description: "Terms of Service.",
        href: "terms",
        title: "Terms of Service",
      },
    ],
    title: "Legal",
  },
  {
    entries: [
      {
        description: "Open-source libraries Doxynix is built on.",
        href: "high-five",
        title: "Open source credits",
      },
    ],
    title: "Optional",
  },
];

export function buildLlmsUrl(baseUrl: string, href: string, fragment = ""): string {
  const base = href.startsWith("http")
    ? href
    : getSitemapUrl(baseUrl, href, DEFAULT_LOCALE, DEFAULT_LOCALE);

  if (fragment === "") {
    return base;
  }

  return `${base}${base.endsWith("/") ? "" : "/"}${fragment}`;
}

export function buildLlmsTxt(baseUrl: string): string {
  const sections = LLMS_SECTIONS.map(({ entries, title }) => {
    const lines = entries.map(({ description, fragment, href, title: entryTitle }) => {
      const url = buildLlmsUrl(baseUrl, href, fragment);

      return `- [${entryTitle}](${url}): ${description}`;
    });

    return `## ${title}\n\n${lines.join("\n")}`;
  });

  return `${HEADER}\n\n${sections.join("\n\n")}\n`;
}
