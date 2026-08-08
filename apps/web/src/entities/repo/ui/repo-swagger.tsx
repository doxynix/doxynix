"use client";

import { ApiReferenceReact, type AnyApiReferenceConfiguration } from "@scalar/api-reference-react";

import { cn } from "@/shared/lib/cn";

import "@scalar/api-reference-react/style.css";

import { useTheme } from "next-themes";

export function RepoSwagger({ spec }: Readonly<{ spec: string }>) {
  const { resolvedTheme } = useTheme();

  const config: AnyApiReferenceConfiguration = {
    agent: {
      disabled: true,
    },
    content: spec,
    defaultOpenAllTags: true,
    hideDarkModeToggle: true,
    // hideTestRequestButton: true,
    isEditable: false,
    layout: "modern",
    mcp: {
      disabled: true,
    },
    searchHotKey: "c",
    showDeveloperTools: "never",
    showSidebar: true,
    theme: "none",
    withDefaultFonts: false,
  };

  return (
    <div className="absolute top-0 right-8 bottom-8 left-8 md:right-12 md:left-12">
      <div
        className={cn(
          "repo-swagger-shell bg-background border-border h-full min-h-0 overflow-x-hidden overflow-y-auto rounded-xl border",
          resolvedTheme === "dark" ? "dark-mode" : "light-mode"
        )}
      >
        <ApiReferenceReact configuration={config} />
      </div>

      <style global jsx>{`
        :global(html),
        :global(body) {
          --scalar-color-blue: var(--color-info) !important;
          --scalar-color-green: var(--color-success) !important;
          --scalar-color-orange: var(--color-warning) !important;
          --scalar-color-yellow: var(--color-warning) !important;
          --scalar-color-red: var(--color-destructive) !important;
          --scalar-color-maroon: var(--color-destructive) !important;
        }

        .repo-swagger-shell {
          min-height: 0;
          scrollbar-gutter: stable;
        }

        .repo-swagger-shell :global(.scalar-app) {
          height: 100% !important;
          min-height: 0 !important;
          width: 100% !important;

          --scalar-font: var(--font-sans), ui-sans-serif, system-ui, sans-serif !important;
          --scalar-font-code: var(--font-mono), ui-monospace, SFMono-Regular, monospace !important;

          --scalar-background-1: var(--card) !important;
          --scalar-background-2: var(--card) !important;
          --scalar-background-3: var(--card) !important;
          --scalar-background-accent: var(--primary) !important;

          --scalar-color-1: var(--text-primary) !important;
          --scalar-color-2: var(--text-secondary) !important;
          --scalar-color-3: var(--text-muted) !important;
          --scalar-color-accent: var(--primary) !important;

          --scalar-border-color: var(--border) !important;
          --scalar-border-width: 1px !important;

          --scalar-radius: var(--radius-md, 12px) !important;
          --scalar-radius-lg: var(--radius-lg, 14px) !important;

          --scalar-transition-speed: 150ms !important;
          --scalar-transition-curve: cubic-bezier(0.4, 0, 0.2, 1) !important;

          --scalar-color-get: var(--color-info) !important;
          --scalar-color-post: var(--color-success) !important;
          --scalar-color-patch: var(--color-warning) !important;
          --scalar-color-put: var(--color-warning) !important;
          --scalar-color-delete: var(--color-destructive) !important;
        }

        .repo-swagger-shell :global(.scalar-app *),
        .repo-swagger-shell :global(.scalar-app pre),
        .repo-swagger-shell :global(.scalar-app code),
        .repo-swagger-shell :global(.scalar-app input),
        .repo-swagger-shell :global(.scalar-app textarea),
        .repo-swagger-shell :global(.scalar-app .operation-path) {
          user-select: text !important;
          -webkit-user-select: text !important;
          min-height: 0;
        }

        .repo-swagger-shell :global(.scalar-app [class*="request-method"]) {
          font-weight: 600 !important;
        }

        .repo-swagger-shell :global(.scalar-app [class*="request-method"]),
        .repo-swagger-shell :global(.scalar-app [class*="sidebar-heading-type"]) {
          --scalar-color-blue: var(--color-info) !important;
          --scalar-color-green: var(--color-success) !important;
          --scalar-color-orange: var(--color-warning) !important;
          --scalar-color-yellow: var(--color-warning) !important;
          --scalar-color-red: var(--color-destructive) !important;
          --scalar-color-maroon: var(--color-destructive) !important;
          --method-color: inherit;
        }

        .repo-swagger-shell :global(.scalar-app [class*="sidebar-heading-type--get"]) {
          color: var(--color-info) !important;
          --method-color: var(--color-info) !important;
        }

        .repo-swagger-shell :global(.scalar-app [class*="sidebar-heading-type--post"]) {
          color: var(--color-success) !important;
          --method-color: var(--color-success) !important;
        }

        .repo-swagger-shell :global(.scalar-app [class*="sidebar-heading-type--patch"]),
        .repo-swagger-shell :global(.scalar-app [class*="sidebar-heading-type--put"]) {
          color: var(--color-warning) !important;
          --method-color: var(--color-warning) !important;
        }

        .repo-swagger-shell :global(.scalar-app [class*="sidebar-heading-type--delete"]),
        .repo-swagger-shell :global(.scalar-app [class*="sidebar-heading-type--del"]) {
          color: var(--color-destructive) !important;
          --method-color: var(--color-destructive) !important;
        }

        .repo-swagger-shell :global(.scalar-app .sidebar-link) {
          transition:
            color var(--scalar-transition-speed) var(--scalar-transition-curve),
            background-color var(--scalar-transition-speed) var(--scalar-transition-curve) !important;
          border-radius: var(--radius-sm, 10px) !important;
          margin: 1px 0 !important;
        }

        .repo-swagger-shell :global(.scalar-app .sidebar-link:hover) {
          background-color: var(--surface-hover, oklch(0.244 0.003 255)) !important;
          color: var(--text-primary) !important;
        }

        .repo-swagger-shell :global(.scalar-app .sidebar-link-active) {
          background-color: var(--surface-selected, oklch(0.282 0.003 255)) !important;
          color: var(--text-primary) !important;
          font-weight: 600 !important;
        }

        .repo-swagger-shell :global(.scalar-app .code-block),
        .repo-swagger-shell :global(.scalar-app pre),
        .repo-swagger-shell :global(.scalar-app .scalar-codeblock) {
          background-color: var(--surface-contrast) !important;
          border: 1px solid var(--border-soft) !important;
          border-radius: var(--radius-md) !important;
          transition: border-color var(--scalar-transition-speed) var(--scalar-transition-curve) !important;
        }

        .repo-swagger-shell :global(.scalar-app .code-block:hover),
        .repo-swagger-shell :global(.scalar-app .scalar-codeblock:hover) {
          border-color: var(--border-accent) !important;
        }

        .repo-swagger-shell :global(.scalar-app button) {
          transition:
            background-color var(--scalar-transition-speed) var(--scalar-transition-curve),
            transform var(--scalar-transition-speed) var(--scalar-transition-curve) !important;
        }

        .repo-swagger-shell :global(.scalar-app *::-webkit-scrollbar) {
          width: 4px !important;
          height: 4px !important;
        }

        .repo-swagger-shell :global(.scalar-app *::-webkit-scrollbar-track) {
          background: transparent !important;
        }

        .repo-swagger-shell :global(.scalar-app *::-webkit-scrollbar-thumb) {
          background-color: var(--border-strong) !important;
          border-radius: 10px !important;
        }

        .repo-swagger-shell :global(.scalar-app *::-webkit-scrollbar-thumb:hover) {
          background-color: var(--text-muted) !important;
        }

        .repo-swagger-shell :global(.scalar-powered-by),
        .repo-swagger-shell :global(a[href*="scalar.com"]),
        .repo-swagger-shell :global(.sidebar-footer),
        .repo-swagger-shell :global(#scalar-header) {
          display: none !important;
        }

        .repo-swagger-shell :global(.light-mode),
        .repo-swagger-shell :global(.dark-mode) {
          background: transparent !important;
        }

        .repo-swagger-shell :global(.section-container) {
          padding: 0 !important;
        }
      `}</style>
    </div>
  );
}
