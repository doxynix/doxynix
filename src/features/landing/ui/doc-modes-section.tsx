import type { ComponentType } from "react";
import { BookOpen, FileCode, FileDiff, GitGraph } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { highlightCode } from "@/shared/lib/shiki";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";
import { CodeWindow } from "@/shared/ui/kit/code-window";

type TabsTriggerItemProps = {
  icon?: ComponentType<{ className?: string }>;
  value: string;
  title: string;
  subTitle: string;
};

type TabsContentItemProps = {
  value: string;
  html: string;
  title: string;
  code: string;
};

function TabsTriggerItem({ icon: Icon, value, title, subTitle }: TabsTriggerItemProps) {
  return (
    <TabsTrigger
      value={value}
      className="group data-[state=active]:bg-landing-bg-light flex items-center justify-start gap-3 rounded-lg border border-transparent px-4 py-4 text-left transition-all data-[state=active]:border-zinc-800"
    >
      <div className="text-muted-foreground group-data-[state=active]:bg-zinc-dark bg-landing-bg-light flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors group-data-[state=active]:text-white">
        {Icon && <Icon />}
      </div>
      <div>
        <p className="text-foreground font-semibold">{title}</p>
        <p className="text-muted-foreground mt-1 text-xs">{subTitle}</p>
      </div>
    </TabsTrigger>
  );
}

function TabsContentItem({ html, value, title, code }: TabsContentItemProps) {
  return (
    <TabsContent
      value={value}
      className="animate-in fade-in slide-in-from-right-4 mt-0 duration-500"
    >
      <CodeWindow codeClassName="text-sm sm:text-base" title={title} codeHtml={html} code={code} />
    </TabsContent>
  );
}

export async function DocModesSection() {
  const t = await getTranslations("Landing");

  const [readmeHtml, apiHtml, archHtml, changelogHtml] = await Promise.all([
    highlightCode(README_CODE, "markdown", "dark"),
    highlightCode(API_CODE, "json", "dark"),
    highlightCode(ARCH_CODE, "markdown", "dark"),
    highlightCode(CHANGELOG_CODE, "markdown", "dark"),
  ]);

  const DOCS: TabsTriggerItemProps[] = [
    {
      icon: BookOpen,
      value: "readme",
      title: t("section_docs_tab_readme_title"),
      subTitle: t("section_docs_tab_readme_subtitle"),
    },
    {
      icon: FileCode,
      value: "api",
      title: t("section_docs_tab_api_title"),
      subTitle: t("section_docs_tab_api_subtitle"),
    },
    {
      icon: GitGraph,
      value: "architecture",
      title: t("section_docs_tab_arch_title"),
      subTitle: t("section_docs_tab_arch_subtitle"),
    },
    {
      icon: FileDiff,
      value: "changelog",
      title: t("section_docs_tab_changelog_title"),
      subTitle: t("section_docs_tab_changelog_subtitle"),
    },
  ];

  const TABS = [
    { value: "readme", html: readmeHtml, title: "README.md", code: README_CODE },
    { value: "api", html: apiHtml, title: "api-v1.json", code: API_CODE },
    {
      value: "architecture",
      html: archHtml,
      title: "docs/architecture/auth-flow.md",
      code: ARCH_CODE,
    },
    { value: "changelog", html: changelogHtml, title: "CHANGELOG.md", code: CHANGELOG_CODE },
  ];

  return (
    <section className="container mx-auto px-4 py-24">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold md:text-5xl">
          {t("section_docs_title_prefix")}{" "}
          <span className="text-muted-foreground">{t("section_docs_title_highlight")}</span>
        </h2>
        <p className="text-muted-foreground mt-4 text-lg">{t("section_docs_desc")}</p>
      </div>

      <Tabs defaultValue="readme" className="mx-auto flex min-h-140 items-center gap-8">
        <TabsList className="flex h-auto flex-wrap items-center justify-start gap-2 bg-transparent">
          {DOCS.map((item) => (
            <TabsTriggerItem key={item.title} {...item} />
          ))}
        </TabsList>
        <div className="w-full max-w-3xl">
          {TABS.map((item) => (
            <TabsContentItem key={item.title} {...item} />
          ))}
        </div>
      </Tabs>
    </section>
  );
}

const README_CODE = `# Getting Started

Welcome to the **Enterprise Core** monorepo.
This project uses Next.js 14 and Neon DB.

## Prerequisites
- Node.js v20+
- Docker (for local redis)

## Quick Setup
$ pnpm install
$ cp .env.example .env.local
$ pnpm dev
`;

const API_CODE = `{
  "path": "/v1/users/subscribe",
  "method": "POST",
  "auth": "Bearer Token",
  "body": {
    "planId": "string (uuid)",
    "cycle": "monthly | yearly"
  },
  "responses": {
    "200": "Subscription Object",
    "403": "Payment Failed"
  }
}`;

const ARCH_CODE = `## Auth Module Internals

The authentication system uses a dual-token strategy (Access + Refresh) stored in HTTP-only cookies.

### Critical Path:
1. \`proxy.ts\` intercepts request.
2. Checks Redis for session validity (O(1) complexity).
3. If expired, triggers **TokenRotationService**.

> **Warning:** The leaky bucket rate limiter shares state across all instances via Upstash.`;

const CHANGELOG_CODE = `## v2.4.0 (2024-03-15)

### 🚀 Features
- Added Stripe Webhook handler in \`services/billing.ts\`
- New metric: "Bus Factor" visualization

### 🐛 Bug Fixes
- Fixed race condition in User creation (Prisma)
- ~~Legacy auth removal~~ (Reverted)`;
