"use client";

import { FileIcon, FileText, GitCommit, Layers } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import type { RepoWorkspace } from "@/entities/repo/model/repo.types";

type Props = {
  onNavigate: (id: null | string) => void;
  workspace: NonNullable<RepoWorkspace>;
};

export function RepoMapOverview({ onNavigate, workspace }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-6">
      <h2 className="text-2xl">{t("repo_map_overview_project_brain")}</h2>
      <div className="flex items-center gap-2">
        {workspace.analysisRef?.commitSha != null && (
          <AppBadge
            className="gap-1 font-mono text-xs"
            variant="outline"
          >
            <GitCommit />
            {workspace.analysisRef.commitSha.slice(0, 7)}
            <CopyButton
              className="opacity-100"
              tooltipSide="bottom"
              tooltipText={tCommon("copy_sha")}
              value={workspace.analysisRef.commitSha}
            />
          </AppBadge>
        )}
        <AppBadge variant="outline">{workspace.summary.repositoryKind}</AppBadge>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 rounded-xl border p-4">
          <div className="flex items-center gap-1 text-xs">
            <Layers /> {t("repo_map_overview_arch_style")}
          </div>
          {workspace.summary.architectureStyle != null && (
            <p className="text-sm">
              {workspace.summary.architectureStyle || t("repo_map_overview_arch_default")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs">
            <FileText /> {t("repo_map_overview_stack")}
          </div>
          <div className="flex flex-wrap gap-2">
            {workspace.summary.stack.map((path) => (
              <div
                className="p-2 text-muted-foreground text-xs"
                key={path}
              >
                <span className="truncate">{path.split("/").pop()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs">
            <FileText /> {t("repo_map_overview_primary_modules")}
          </div>
          <div className="gap-2">
            {workspace.navigation.primaryModules.map((path) => (
              <AppButton
                className="p-2 text-xs"
                key={path}
                onClick={() => onNavigate(path)}
                variant="ghost"
              >
                <FileIcon />
                <span className="truncate">{path.split("/").pop()}</span>
              </AppButton>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-xs">{t("repo_map_overview_purpose")}</div>
          <div className="italic rounded-xl border p-4 text-muted-foreground text-xs">
            {`"${workspace.summary.purpose}"`}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs">
            <FileText /> {t("repo_map_overview_resources")}
          </div>
          <div className="flex flex-wrap gap-2">
            {workspace.navigation.primaryEntrypoints.map((path) => (
              <AppButton
                className="p-2 text-xs"
                key={path}
                onClick={() => onNavigate(path)}
                variant="ghost"
              >
                <FileIcon />
                <span className="truncate">{path.split("/").pop()}</span>
              </AppButton>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
