"use client";

import {
  Activity,
  FileCode,
  FileIcon,
  FileText,
  FolderTree,
  Inspect,
  Loader2,
  Map,
  Search,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { ExternalLink } from "@/shared/ui/kit/external-link";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import type { PRImpact, PRNumber } from "@/entities/pr/model/pr.types";
import {
  buildRepoCodeHref,
  buildRepoDocsHref,
  buildRepoMapHref,
} from "@/entities/repo/model/repo-workspace-navigation";

import { usePrStage } from "../model/use-pr-stage";

type Props = {
  analysis: PRNumber;
  impact: PRImpact;
  name: string;
  owner: string;
  repoId: string;
};

type StatusConfigKey = "ANALYZING" | "COMPLETED" | "FAILED" | "PENDING";

type PrDetailsItem =
  | { isCopy: true; isStatus?: false; isTime?: false; label: string; value: string | undefined }
  | { isStatus: true; isCopy?: false; isTime?: false; label: string; value: unknown }
  | { isTime: true; isCopy?: false; isStatus?: false; label: string; value: Date | null }
  | { isCopy?: false; isStatus?: false; isTime?: false; label: string; value: number };

type ImpactStat = {
  label: string;
  value: string | number;
};

export function RepoPullDetailsContent({ analysis, impact, name, owner, repoId }: Readonly<Props>) {
  const locale = useLocale();
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const utils = trpc.useUtils();

  const STATUS_CONFIG: Record<StatusConfigKey, { className: string; label: string }> = {
    ANALYZING: { className: "text-foreground", label: t("repo_pull_status_analyzing") },
    COMPLETED: { className: "text-success", label: t("repo_pull_status_completed") },
    FAILED: { className: "text-destructive", label: tCommon("failed") },
    PENDING: { className: "text-warning", label: t("repo_pull_status_pending") },
  } as const;

  const { data: comments, isLoading: isCommentsLoading } = trpc.analysis.getComments.useQuery(
    { analysisId: analysis?.analysis.id ?? "" },
    { enabled: analysis?.analysis.id != null },
  );

  const { isStaging, stageFix } = usePrStage(repoId);

  const createFixMutation = trpc.analysis.createFix.useMutation({
    onError: (err) => {
      toast.error(t("repo_pull_fix_error"), {
        description: err.message,
      });
    },
    onSuccess: (data) => {
      if (data.success === true && data.fixId != null) {
        toast.success(t("repo_pull_fix_queued"), {
          description: t("repo_pull_fix_queued_desc"),
        });
        void utils.analysis.getByRepository.invalidate({ repoId });
      }
    },
  });

  const changedFiles = impact?.changedFiles ?? [];
  const affectedZones = impact?.affectedZones ?? [];
  const affectedNodes = impact?.affectedNodes ?? [];
  const topFindings = impact?.topFindings ?? [];
  const fixes = impact?.fixes ?? [];

  const handleFixSingle = (comment: any) => {
    createFixMutation.mutate({
      findings: [
        {
          file: comment.filePath,
          line: comment.line,
          suggestion: comment.bodyHtml,
          type: comment.findingType.toLowerCase(),
        },
      ],
      prAnalysisId: analysis?.analysis.id,
      repoId,
    });
  };

  const handleFixAll = () => {
    if (comments == null || comments.renderedComments.length === 0) {
      return;
    }

    const findingsToFix = comments.renderedComments.map((comment) => ({
      file: comment.filePath,
      line: comment.line,
      suggestion: comment.bodyHtml,
      type: comment.findingType.toLowerCase(),
    }));

    createFixMutation.mutate({
      findings: findingsToFix,
      prAnalysisId: analysis?.analysis.id,
      repoId,
    });
  };

  const PR_DETAILS_ITEMS: PrDetailsItem[] = [
    {
      isCopy: true,
      label: t("repo_pull_detail_base_sha"),
      value: analysis?.analysis.baseSha.slice(0, 7),
    },
    { isStatus: true, label: tCommon("status"), value: analysis?.analysis.status },
    { label: t("repo_pull_detail_changed_files"), value: impact?.summary.affectedFiles ?? 0 },
    { label: t("repo_pull_detail_affected_zones"), value: impact?.summary.affectedZones ?? 0 },
    {
      isTime: true,
      label: tCommon("created"),
      value: analysis?.analysis.createdAt ?? null,
    },
  ];

  const IMPACT_STATS: ImpactStat[] = [
    { label: t("repo_pull_stat_nodes"), value: impact?.summary.affectedNodes ?? 0 },
    { label: t("repo_pull_stat_findings"), value: impact?.summary.findings ?? 0 },
    { label: t("repo_pull_stat_fixes"), value: impact?.summary.linkedFixes ?? 0 },
    {
      label: t("repo_pull_stat_primary_view"),
      value: impact?.navigationHints.recommendedView ?? t("repo_pull_stat_primary_view_default"),
    },
    {
      label: t("repo_pull_stat_total_issues"),
      value: comments?.renderedComments.length ?? 0,
    },
    {
      label: t("repo_pull_stat_generated_fixes"),
      value: fixes.length,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree />
              {t("repo_pull_affected_zones")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {affectedZones.length > 0 ? (
              affectedZones.map((zone) => (
                <div
                  className="rounded-xl border p-4"
                  key={zone.nodeId}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{zone.label}</p>
                      <p className="text-muted-foreground text-xs">{zone.path}</p>
                    </div>
                    <AppBadge variant="outline">{zone.impactScore}</AppBadge>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-3 text-muted-foreground text-xs">
                    <span>
                      {zone.fileCount} {t("repo_pull_unit_files")}
                    </span>
                    <span>
                      {zone.findingCount} {t("repo_pull_unit_findings")}
                    </span>
                    <span>{zone.kind}</span>
                    <span>{zone.relatedChangedFiles}</span>
                  </div>
                  <AppButton
                    asChild
                    size="sm"
                    variant="outline"
                  >
                    <Link href={buildRepoMapHref({ name, nodeId: zone.nodeId, owner })}>
                      <Map /> {t("repo_pull_open_in_map")}
                    </Link>
                  </AppButton>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">{t("repo_pull_no_zones")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inspect /> {t("repo_pull_critical_hotspots")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {affectedNodes.length > 0 ? (
              affectedNodes.map((node) => (
                <div
                  className="rounded-xl border p-4"
                  key={node.nodeId}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{node.label}</p>
                      <AppBadge className="text-xs">{node.nodeType}</AppBadge>
                      <p className="text-muted-foreground text-xs">{node.path}</p>
                    </div>
                    <AppBadge variant="outline">{node.impactScore}</AppBadge>
                  </div>
                  <p className="text-muted-foreground text-xs">{node.whyAffected}</p>
                  <div className="mb-3 flex flex-wrap gap-3 text-muted-foreground text-xs">
                    <span>
                      {node.fileCount} {t("repo_pull_unit_files")}
                    </span>
                    <span>
                      {node.findingCount} {t("repo_pull_unit_findings")}
                    </span>
                    <span>{node.kind}</span>
                    <span>{node.relatedChangedFiles}</span>
                  </div>
                  <AppButton
                    asChild
                    size="sm"
                    variant="outline"
                  >
                    <Link href={buildRepoMapHref({ name, nodeId: node.nodeId, owner })}>
                      <Map /> {t("repo_pull_open_in_map")}
                    </Link>
                  </AppButton>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">{t("repo_pull_no_zones")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileIcon />
              {t("repo_pull_changed_files")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {changedFiles.length > 0 ? (
              changedFiles.map((file) => (
                <div
                  className="rounded-xl border p-4"
                  key={file.filePath}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <code className="text-sm">{file.filePath}</code>
                    <AppBadge variant="outline">{file.status}</AppBadge>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-3 text-muted-foreground text-xs">
                    <span className="text-success">+{file.additions}</span>
                    <span className="text-destructive">−{file.deletions}</span>
                    <span>
                      {file.findingCount} {t("repo_pull_unit_findings")}
                    </span>
                    {file.zoneLabel != null && <span>{file.zoneLabel}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AppButton
                      asChild
                      size="sm"
                      variant="ghost"
                    >
                      <Link
                        href={buildRepoCodeHref({
                          name,
                          nodeId: file.nodeId,
                          owner,
                          path: file.filePath,
                        })}
                      >
                        <FileCode />
                        {t("repo_pull_view_code")}
                      </Link>
                    </AppButton>
                    {file.zoneId != null && (
                      <AppButton
                        asChild
                        size="sm"
                        variant="ghost"
                      >
                        <Link href={buildRepoMapHref({ name, nodeId: file.zoneId, owner })}>
                          <Map /> {t("repo_pull_view_map")}
                        </Link>
                      </AppButton>
                    )}
                    {file.nodeId != null && (
                      <AppButton
                        asChild
                        size="sm"
                        variant="ghost"
                      >
                        <Link href={buildRepoDocsHref({ name, nodeId: file.nodeId, owner })}>
                          <FileText /> {t("repo_pull_view_docs")}
                        </Link>
                      </AppButton>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">{t("repo_pull_no_changed_snapshot")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck />
              {t("repo_pull_detected_issues")} ({comments?.renderedComments.length ?? 0})
            </CardTitle>
            {comments != null && comments.renderedComments.length > 0 && (
              <AppButton
                className="flex items-center gap-1.5 bg-success font-semibold text-success-foreground text-xs hover:bg-success/90"
                disabled={createFixMutation.isPending}
                onClick={handleFixAll}
                size="sm"
              >
                {createFixMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wand2 className="size-3.5" />
                )}
                {t("repo_pull_autofix_all")}
              </AppButton>
            )}
          </CardHeader>
          <CardContent>
            {isCommentsLoading ? (
              <Loader2 className="mx-auto animate-spin" />
            ) : comments != null && comments.renderedComments.length > 0 ? (
              <div className="flex flex-col gap-4">
                {comments.renderedComments.map((comment) => (
                  <div
                    className="group relative overflow-hidden rounded-xl border p-4"
                    key={comment.id}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {comment.filePath}:{comment.line}
                      </code>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-muted-foreground text-xs uppercase tracking-wide">
                          {comment.findingType}
                        </span>
                        <span className="font-bold text-muted-foreground text-xs">
                          {t("repo_pull_risk_label", { level: comment.riskLevel })}
                        </span>
                      </div>
                    </div>
                    <article
                      className="prose dark:prose-invert wrap-break-word mb-4 min-w-0 max-w-none prose-pre:bg-transparent prose-pre:p-0 text-xs"
                      dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
                    />

                    <div className="flex justify-end border-border/40 border-t pt-3">
                      <AppButton
                        className="flex items-center gap-1.5 font-medium text-xs transition-standard hover:border-success/30 hover:bg-success/5 hover:text-success"
                        disabled={createFixMutation.isPending}
                        onClick={() => handleFixSingle(comment)}
                        size="sm"
                        variant="outline"
                      >
                        {createFixMutation.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="size-3.5" />
                        )}
                        {t("repo_pull_autofix_single")}
                      </AppButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t("repo_pull_no_comments")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-bold text-sm">{t("repo_pull_details_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {PR_DETAILS_ITEMS.map((item) => (
              <div
                className="flex items-baseline justify-between"
                key={item.label}
              >
                <span className="text-muted-foreground text-xs">{item.label}:</span>
                <div className="flex items-center gap-1">
                  {item.isCopy === true && (
                    <CopyButton
                      className="opacity-100"
                      tooltipText={t("repo_pull_copy_sha")}
                      value={analysis?.analysis.baseSha ?? ""}
                    />
                  )}
                  {item.isStatus === true ? (
                    <span
                      className={cn(
                        "font-bold",
                        STATUS_CONFIG[item.value as keyof typeof STATUS_CONFIG].className,
                      )}
                    >
                      {STATUS_CONFIG[item.value as keyof typeof STATUS_CONFIG].label}
                    </span>
                  ) : item.isTime === true ? (
                    <TimeAgo
                      date={item.value ?? ""}
                      locale={locale}
                    />
                  ) : (
                    <span className={cn("font-medium text-xs")}>
                      {item.value ?? t("repo_pull_na")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity />
              {t("repo_pull_impact_summary")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {IMPACT_STATS.map((stat) => (
                <div
                  className="rounded-lg border bg-muted p-3"
                  key={stat.label}
                >
                  <p className="mb-1 font-bold text-muted-foreground text-xs">{stat.label}</p>
                  <p className="font-black text-lg capitalize">{stat.value}</p>
                </div>
              ))}
            </div>

            {impact?.navigationHints.primaryNodeId != null && (
              <div className="flex flex-wrap gap-2">
                <AppButton
                  asChild
                  size="sm"
                >
                  <Link
                    href={buildRepoMapHref({
                      name,
                      nodeId: impact.navigationHints.primaryNodeId,
                      owner,
                    })}
                  >
                    <Search /> {t("repo_pull_inspect_primary")}
                  </Link>
                </AppButton>
                {impact.navigationHints.primaryFilePath != null && (
                  <AppButton
                    asChild
                    size="sm"
                    variant="outline"
                  >
                    <Link
                      href={buildRepoCodeHref({
                        name,
                        nodeId: impact.navigationHints.primaryNodeId,
                        owner,
                        path: impact.navigationHints.primaryFilePath,
                      })}
                    >
                      <FileCode /> {t("repo_pull_open_code")}
                    </Link>
                  </AppButton>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex flex-row items-center gap-2 text-base">
              <Search />
              {t("repo_pull_top_findings")}
            </CardTitle>
            <AppButton
              className="flex items-center gap-1.5 bg-success font-semibold text-success-foreground text-xs hover:bg-success/90"
              disabled={createFixMutation.isPending}
              onClick={handleFixAll}
              size="sm"
            >
              {createFixMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wand2 className="size-3.5" />
              )}
              {t("repo_pull_autofix_all")}
            </AppButton>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {topFindings.length > 0 ? (
              topFindings.slice(0, 4).map((finding) => (
                <div
                  className="rounded-lg border p-3"
                  key={finding.id}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{finding.title}</p>
                    <AppBadge variant="outline">{finding.riskLevel}</AppBadge>
                  </div>
                  <p className="mb-2 text-muted-foreground text-xs">
                    {finding.filePath}:{finding.line}
                  </p>
                  <article
                    className="prose dark:prose-invert wrap-break-word min-w-0 max-w-none prose-pre:bg-transparent prose-pre:p-0 text-xs"
                    dangerouslySetInnerHTML={{ __html: finding.messageHtml }}
                  />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">{t("repo_pull_no_findings")}</p>
            )}
          </CardContent>
        </Card>

        {fixes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("repo_pull_linked_fixes")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {fixes.map((fix) => (
                <div
                  className="rounded-lg border p-3"
                  key={fix.id}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{fix.title}</p>
                    <AppBadge variant="outline">{fix.status}</AppBadge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fix.status === "COMPLETED" && (
                      <AppButton
                        disabled={isStaging}
                        onClick={() => stageFix(fix.id)}
                        size="sm"
                        variant="outline"
                      >
                        {t("repo_pull_add_to_draft")}
                      </AppButton>
                    )}
                    {fix.githubPrUrl != null && (
                      <ExternalLink href={fix.githubPrUrl}>
                        {t("repo_pull_open_github_pr", { number: fix.githubPrNumber ?? "?" })}
                      </ExternalLink>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
