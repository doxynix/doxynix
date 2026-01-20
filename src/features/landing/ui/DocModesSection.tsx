import { ComponentType } from "react";
import { BookOpen, FileCode, FileDiff, GitGraph } from "lucide-react";

import { highlightCode } from "@/shared/lib/shiki";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { CodeWindow } from "./CodeWindow";

function TabsTriggerItem({
  icon: Icon,
  value,
  titleText,
  subTitleText,
}: {
  icon?: ComponentType<{ className?: string }>;
  value: string;
  titleText: string;
  subTitleText: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="group data-[state=active]:bg-landing-bg-light flex items-center justify-start gap-3 rounded-lg border border-transparent px-4 py-4 text-left transition-all data-[state=active]:border-zinc-800"
    >
      <div className="text-muted-foreground group-data-[state=active]:bg-zinc-dark bg-landing-bg-light flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors group-data-[state=active]:text-white">
        {Icon && <Icon />}
      </div>
      <div>
        <p className="text-foreground font-semibold">{titleText}</p>
        <p className="text-muted-foreground mt-1 text-xs">{subTitleText}</p>
      </div>
    </TabsTrigger>
  );
}

function TabsContentItem({
  html,
  value,
  title,
  code,
}: {
  value: string;
  html: string;
  title: string;
  code: string;
}) {
  return (
    <TabsContent
      value={value}
      className="animate-in fade-in slide-in-from-right-4 mt-0 duration-500"
    >
      <CodeWindow title={title} codeHtml={html} code={code} />
    </TabsContent>
  );
}

export async function DocModesSection() {
  const [readmeHtml, apiHtml, archHtml, changelogHtml] = await Promise.all([
    highlightCode(README_CODE, "markdown", "dark"),
    highlightCode(API_CODE, "json", "dark"),
    highlightCode(ARCH_CODE, "markdown", "dark"),
    highlightCode(CHANGELOG_CODE, "markdown", "dark"),
  ]);

  return (
    <section className="relative z-10 container mx-auto px-4 py-24">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold md:text-5xl">
          Complete <span className="text-muted-foreground">Documentation Suite</span>
        </h2>
        <p className="text-muted-foreground mt-4 text-lg">
          From high-level overview to low-level byte manipulation. We generate every format your
          team needs.
        </p>
      </div>

      <Tabs
        defaultValue="readme"
        className="mx-auto flex min-h-112.5 w-full max-w-6xl flex-col gap-8 lg:flex-row"
      >
        <TabsList className="flex h-auto w-full flex-col items-stretch justify-start gap-2 bg-transparent p-0 lg:w-1/3">
          <TabsTriggerItem
            icon={BookOpen}
            value="readme"
            titleText="Onboarding & Guides"
            subTitleText="README.md, User Guides"
          />
          <TabsTriggerItem
            icon={FileCode}
            value="api"
            titleText="API Reference"
            subTitleText="Swagger/OpenAPI specs"
          />
          <TabsTriggerItem
            icon={GitGraph}
            value="architecture"
            titleText="Architecture Deep Dive"
            subTitleText="Code logic & DB schemas"
          />
          <TabsTriggerItem
            icon={FileDiff}
            value="changelog"
            titleText="Smart Changelog"
            subTitleText="Automated diff analysis"
          />
        </TabsList>

        <div className="w-full lg:w-2/3">
          <TabsContentItem value="readme" html={readmeHtml} title="README.md" code={README_CODE} />
          <TabsContentItem value="api" html={apiHtml} title="api-v1.json" code={API_CODE} />
          <TabsContentItem
            value="architecture"
            html={archHtml}
            title="docs/architecture/auth-flow.md"
            code={ARCH_CODE}
          />
          <TabsContentItem
            value="changelog"
            html={changelogHtml}
            title="CHANGELOG.md"
            code={CHANGELOG_CODE}
          />
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
\`\`\`bash
$ pnpm install
$ cp .env.example .env.local
$ pnpm dev
\`\`\``;

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
