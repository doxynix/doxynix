"use client";
import {
  Activity,
  FileCode,
  FileText,
  FolderTree,
  Map,
  Search,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { ExternalLink } from "@/shared/ui/kit/external-link";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { PRNumber } from "@/entities/pr/model/pr.types";
import {
  buildRepoCodeHref,
  buildRepoDocsHref,
  buildRepoMapHref,
} from "@/entities/repo/model/repo-workspace-navigation";

import { buildImpactStats, buildPrDetailItems } from "../model/pr-details";
import { usePrDetails } from "../model/use-pr-details";
import { PrDetailsSummary } from "./pr-details-summary";

type Props = {
  analysis: PRNumber;
  impact: PRNumber;
  name: string;
  owner: string;
  repoId: string;
};

function formatEnumLabel(value: string) {
  const normalized = value.toLowerCase().replaceAll("_", " ");

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function fileStatusTone(status: string) {
  if (status === "added") {
    return "border-success/30 text-success";
  }

  if (status === "removed") {
    return "border-destructive/30 text-destructive";
  }

  if (status === "modified") {
    return "border-warning/30 text-warning";
  }

  return undefined;
}

function impactTone(score: number) {
  if (score >= 80) {
    return "border-destructive/30 text-destructive";
  }

  if (score >= 50) {
    return "border-warning/30 text-warning";
  }

  return undefined;
}

function riskTone(score: number) {
  if (score >= 80) {
    return "border-destructive/30 text-destructive";
  }

  if (score >= 50) {
    return "border-warning/30 text-warning";
  }

  return undefined;
}

export function RepoPullDetailsContent({ analysis, impact, name, owner, repoId }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const {
    comments,
    commentsTotal,
    fetchNextCommentsPage,
    fetchNextFixesPage,
    fixAll,
    fixOne,
    fixes,
    hasNextCommentsPage,
    hasNextFixesPage,
    isCommentsLoading,
    isFetchingNextCommentsPage,
    isFetchingNextFixesPage,
    isFixing,
    isStaging,
    stageFix,
  } = usePrDetails({ analysis, impact, repoId });

  const changedFiles = impact?.changedFiles ?? [];
  const affectedZones = impact?.affectedZones ?? [];
  const affectedNodes = impact?.affectedNodes ?? [];
  const topFindings = impact?.topFindings ?? [];
  const commentsCount = commentsTotal ?? 0;
  const linkedFixes = impact?.summary.linkedFixes ?? 0;

  const detailItems = buildPrDetailItems({
    analysis,
    impact,
    labels: {
      affectedZones: t("repo_pull_detail_affected_zones"),
      baseSha: t("repo_pull_detail_base_sha"),
      changedFiles: t("repo_pull_detail_changed_files"),
      created: tCommon("created"),
      status: tCommon("status"),
    },
  });

  const impactStats = buildImpactStats({
    commentsCount,
    fixesCount: linkedFixes,
    impact,
    labels: {
      findings: t("repo_pull_stat_findings"),
      fixes: t("repo_pull_stat_fixes"),
      generatedFixes: t("repo_pull_stat_generated_fixes"),
      nodes: t("repo_pull_stat_nodes"),
      primaryView: t("repo_pull_stat_primary_view"),
      primaryViewFallback: t("repo_pull_stat_primary_view_default"),
      totalIssues: t("repo_pull_stat_total_issues"),
    },
  });

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree className="text-muted-foreground" />
              {t("repo_pull_affected_title")}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="files">
              <TabsList className="h-auto w-fit flex-wrap justify-start gap-0.5 p-0.5">
                <TabsTrigger
                  className="px-2.5 py-1 text-xs"
                  value="files"
                >
                  {t("repo_pull_changed_files")}
                  <span className="text-muted-foreground">{changedFiles.length}</span>
                </TabsTrigger>
                <TabsTrigger
                  className="px-2.5 py-1 text-xs"
                  value="nodes"
                >
                  {t("repo_pull_stat_nodes")}
                  <span className="text-muted-foreground">{affectedNodes.length}</span>
                </TabsTrigger>
                <TabsTrigger
                  className="px-2.5 py-1 text-xs"
                  value="zones"
                >
                  {t("repo_pull_affected_zones")}
                  <span className="text-muted-foreground">{affectedZones.length}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent
                className="mt-3 flex flex-col"
                value="files"
              >
                {changedFiles.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground text-sm">
                    {t("repo_pull_no_changed_snapshot")}
                  </p>
                ) : (
                  changedFiles.map((file) => {
                    const fileName = file.filePath.split("/").pop() ?? file.filePath;
                    const dirName = file.filePath.split("/").slice(0, -1).join("/");

                    return (
                      <div
                        className="flex items-start gap-2.5 border-t py-2.5 first:border-t-0 first:pt-0 last:pb-0"
                        key={file.filePath}
                      >
                        <AppBadge
                          className={fileStatusTone(file.status)}
                          variant="outline"
                        >
                          {formatEnumLabel(file.status)}
                        </AppBadge>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-sm">{fileName}</p>
                          <p className="truncate text-muted-foreground text-xs">{dirName}</p>

                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                            <span className="text-success">+{file.additions}</span>
                            <span className="text-destructive">−{file.deletions}</span>
                            <span className="text-muted-foreground">
                              {file.findingCount} {t("repo_pull_unit_findings")}
                            </span>
                            {file.zoneLabel != null && (
                              <span className="text-muted-foreground">{file.zoneLabel}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <AppTooltip content={t("repo_pull_view_code")}>
                            <AppButton
                              asChild
                              size="icon-xs"
                              variant="ghost"
                            >
                              <Link
                                aria-label={t("repo_pull_view_code")}
                                href={buildRepoCodeHref({
                                  name,
                                  nodeId: file.nodeId,
                                  owner,
                                  path: file.filePath,
                                })}
                              >
                                <FileCode />
                              </Link>
                            </AppButton>
                          </AppTooltip>

                          {file.zoneId != null && (
                            <AppTooltip content={t("repo_pull_view_map")}>
                              <AppButton
                                asChild
                                size="icon-xs"
                                variant="ghost"
                              >
                                <Link
                                  aria-label={t("repo_pull_view_map")}
                                  href={buildRepoMapHref({
                                    name,
                                    nodeId: file.zoneId,
                                    owner,
                                  })}
                                >
                                  <Map />
                                </Link>
                              </AppButton>
                            </AppTooltip>
                          )}

                          {file.nodeId != null && (
                            <AppTooltip content={t("repo_pull_view_docs")}>
                              <AppButton
                                asChild
                                size="icon-xs"
                                variant="ghost"
                              >
                                <Link
                                  aria-label={t("repo_pull_view_docs")}
                                  href={buildRepoDocsHref({
                                    name,
                                    nodeId: file.nodeId,
                                    owner,
                                  })}
                                >
                                  <FileText />
                                </Link>
                              </AppButton>
                            </AppTooltip>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent
                className="mt-3 flex flex-col"
                value="nodes"
              >
                {affectedNodes.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground text-sm">
                    {t("no_data_yet")}
                  </p>
                ) : (
                  affectedNodes.map((node) => (
                    <div
                      className="flex items-start gap-2.5 border-t py-2.5 first:border-t-0 first:pt-0 last:pb-0"
                      key={node.nodeId}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate font-medium text-sm">{node.label}</p>
                          <AppBadge variant="outline">{formatEnumLabel(node.nodeType)}</AppBadge>
                          <AppBadge
                            className={impactTone(node.impactScore)}
                            variant="outline"
                          >
                            {node.impactScore}
                          </AppBadge>
                        </div>

                        <p className="truncate text-muted-foreground text-xs">{node.path}</p>
                        <p className="mt-0.5 text-muted-foreground text-xs">{node.whyAffected}</p>

                        <div className="mt-1 flex flex-wrap gap-x-3 text-muted-foreground text-xs">
                          <span>
                            {node.fileCount} {t("repo_pull_unit_files")}
                          </span>
                          <span>
                            {node.findingCount} {t("repo_pull_unit_findings")}
                          </span>
                        </div>
                      </div>

                      <AppTooltip content={t("repo_pull_open_in_map")}>
                        <AppButton
                          asChild
                          size="icon-xs"
                          variant="ghost"
                        >
                          <Link
                            aria-label={t("repo_pull_open_in_map")}
                            href={buildRepoMapHref({
                              name,
                              nodeId: node.nodeId,
                              owner,
                            })}
                          >
                            <Map />
                          </Link>
                        </AppButton>
                      </AppTooltip>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent
                className="mt-3 flex flex-col"
                value="zones"
              >
                {affectedZones.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground text-sm">
                    {t("repo_pull_no_zones")}
                  </p>
                ) : (
                  affectedZones.map((zone) => (
                    <div
                      className="flex items-start gap-2.5 border-t py-2.5 first:border-t-0 first:pt-0 last:pb-0"
                      key={zone.nodeId}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate font-medium text-sm">{zone.label}</p>
                          <AppBadge
                            className={impactTone(zone.impactScore)}
                            variant="outline"
                          >
                            {zone.impactScore}
                          </AppBadge>
                        </div>

                        <p className="truncate text-muted-foreground text-xs">{zone.path}</p>

                        <div className="mt-1 flex flex-wrap gap-x-3 text-muted-foreground text-xs">
                          <span>
                            {zone.fileCount} {t("repo_pull_unit_files")}
                          </span>
                          <span>
                            {zone.findingCount} {t("repo_pull_unit_findings")}
                          </span>
                        </div>
                      </div>

                      <AppTooltip content={t("repo_pull_open_in_map")}>
                        <AppButton
                          asChild
                          size="icon-xs"
                          variant="ghost"
                        >
                          <Link
                            aria-label={t("repo_pull_open_in_map")}
                            href={buildRepoMapHref({
                              name,
                              nodeId: zone.nodeId,
                              owner,
                            })}
                          >
                            <Map />
                          </Link>
                        </AppButton>
                      </AppTooltip>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="text-muted-foreground" />
              {t("repo_pull_detected_issues")}
            </CardTitle>

            <CardDescription>
              {t("repo_pull_card_issues", { count: commentsCount })}
            </CardDescription>

            {comments.length > 0 && (
              <CardAction>
                <LoadingButton
                  aria-label={t("repo_pull_autofix_all")}
                  className="gap-1.5"
                  isLoading={isFixing}
                  onClick={fixAll}
                  size="sm"
                  variant="outline"
                >
                  <Wand2 /> {t("repo_pull_autofix_all")}
                </LoadingButton>
              </CardAction>
            )}
          </CardHeader>

          <CardContent>
            {isCommentsLoading ? (
              <SkeletonList
                className="flex flex-col"
                count={3}
                itemClassName="border-t py-3 first:border-t-0 first:pt-0"
                renderItem={() => (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <SkeletonText
                        lines={1}
                        widths={["w-56"]}
                      />
                      <div className="flex items-center gap-3">
                        <SkeletonText
                          lines={1}
                          widths={["w-16"]}
                        />
                        <SkeletonText
                          lines={1}
                          widths={["w-16"]}
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <SkeletonText
                        lines={3}
                        widths={["w-full", "w-full", "w-2/3"]}
                      />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Skeleton className="h-8 w-24 rounded-lg" />
                    </div>
                  </>
                )}
              />
            ) : comments.length > 0 ? (
              <div className="flex flex-col">
                {comments.map((comment) => (
                  <div
                    className="border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
                    key={comment.id}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-surface-hover px-1.5 py-0.5 text-xs">
                        {comment.filePath}:{comment.line}
                      </span>

                      <span className="text-muted-foreground text-xs">
                        {formatEnumLabel(comment.findingType)}
                      </span>

                      <AppBadge
                        className={riskTone(comment.riskLevel)}
                        variant="outline"
                      >
                        {t("repo_pull_risk_label", { level: comment.riskLevel })}
                      </AppBadge>

                      <LoadingButton
                        aria-label={t("repo_pull_autofix_single")}
                        className="ml-auto gap-1.5"
                        isLoading={isFixing}
                        onClick={() => fixOne(comment)}
                        size="sm"
                        variant="outline"
                      >
                        <Wand2 /> {t("fix")}
                      </LoadingButton>
                    </div>

                    <article
                      className="markdown-prose prose dark:prose-invert wrap-break-word mt-2 min-w-0 max-w-none text-xs"
                      dangerouslySetInnerHTML={{ __html: comment.bodyHtml }} // Sanitized by markdownToHtml (rehype-sanitize) on the server.
                    />
                  </div>
                ))}

                {hasNextCommentsPage && (
                  <LoadingButton
                    className="mt-3 w-full"
                    disabled={isFetchingNextCommentsPage}
                    isLoading={isFetchingNextCommentsPage}
                    onClick={() => void fetchNextCommentsPage()}
                    size="sm"
                    variant="ghost"
                  >
                    {tCommon("more")}
                  </LoadingButton>
                )}
              </div>
            ) : (
              <p className="py-6 text-center text-muted-foreground text-sm">
                {t("repo_pull_no_comments")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <PrDetailsSummary
          items={detailItems}
          title={t("repo_pull_details_title")}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="text-muted-foreground" />
              {t("repo_pull_impact_summary")}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col">
            <div className="grid grid-cols-2 gap-4">
              {impactStats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-muted-foreground text-xs">{stat.label}</p>
                  <p className="mt-0.5 font-semibold text-lg capitalize">{stat.value}</p>
                </div>
              ))}
            </div>

            {impact?.navigationHints.primaryNodeId != null && (
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="text-muted-foreground" />
              {t("repo_pull_top_findings")}
            </CardTitle>

            <CardAction>
              <AppTooltip content={t("repo_pull_autofix_all")}>
                <LoadingButton
                  aria-label={t("repo_pull_autofix_all")}
                  isLoading={isFixing}
                  onClick={fixAll}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Wand2 />
                </LoadingButton>
              </AppTooltip>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col">
            {topFindings.length > 0 ? (
              topFindings.slice(0, 4).map((finding) => (
                <div
                  className="border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
                  key={finding.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{finding.title}</p>
                    <AppBadge
                      className={riskTone(finding.riskLevel)}
                      variant="outline"
                    >
                      {t("repo_pull_risk_label", { level: finding.riskLevel })}
                    </AppBadge>
                  </div>

                  <p className="mt-0.5 text-muted-foreground text-xs">
                    {finding.filePath}:{finding.line}
                  </p>

                  <article
                    className="markdown-prose prose dark:prose-invert wrap-break-word mt-1.5 min-w-0 max-w-none text-xs"
                    dangerouslySetInnerHTML={{ __html: finding.messageHtml }} // Sanitized by markdownToHtml (rehype-sanitize) on the server.
                  />
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-muted-foreground text-sm">
                {t("repo_pull_no_findings")}
              </p>
            )}
          </CardContent>
        </Card>

        {linkedFixes > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("repo_pull_linked_fixes")}
                <span className="ml-1.5 text-muted-foreground">{linkedFixes}</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col">
              {fixes.map((fix) => (
                <div
                  className="border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
                  key={fix.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{fix.title}</p>
                    <AppBadge
                      className={
                        fix.status === "COMPLETED"
                          ? "border-success/30 text-success"
                          : fix.status === "FAILED"
                            ? "border-destructive/30 text-destructive"
                            : undefined
                      }
                      variant="outline"
                    >
                      {formatEnumLabel(fix.status)}
                    </AppBadge>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
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

              {hasNextFixesPage && (
                <LoadingButton
                  className="mt-3 w-full"
                  disabled={isFetchingNextFixesPage}
                  isLoading={isFetchingNextFixesPage}
                  onClick={() => void fetchNextFixesPage()}
                  size="sm"
                  variant="ghost"
                >
                  {tCommon("more")}
                </LoadingButton>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
