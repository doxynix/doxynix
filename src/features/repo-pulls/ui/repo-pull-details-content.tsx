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
} from "lucide-react";

import { trpc, type PRImpact, type PRNumber } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { formatRelativeTime } from "@/shared/lib/date-utils";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { ExternalLink } from "@/shared/ui/kit/external-link";
import { Link } from "@/i18n/routing";

import {
  buildRepoCodeHref,
  buildRepoDocsHref,
  buildRepoMapHref,
} from "@/entities/repo-details/model/repo-workspace-navigation";

import { usePrStage } from "../model/use-pr-stage";

type Props = {
  analysis: PRNumber;
  impact: PRImpact;
  name: string;
  owner: string;
  repoId: string;
};

const STATUS_CONFIG = {
  ANALYZING: { className: "text-foreground", label: "Analyzing" },
  COMPLETED: { className: "text-success", label: "Completed" },
  FAILED: { className: "text-destructive", label: "Failed" },
  PENDING: { className: "text-warning", label: "Pending" },
} as const;

export function RepoPullDetailsContent({ analysis, impact, name, owner, repoId }: Readonly<Props>) {
  const { data: comments, isLoading: isCommentsLoading } = trpc.prAnalysis.getComments.useQuery(
    { analysisId: analysis?.id ?? "" },
    { enabled: analysis?.id != null }
  );

  const { isStaging, stageFix } = usePrStage(repoId);

  const changedFiles = impact?.changedFiles ?? [];
  const affectedZones = impact?.affectedZones ?? [];
  const affectedNodes = impact?.affectedNodes ?? [];
  const topFindings = impact?.topFindings ?? [];
  const fixes = impact?.fixes ?? [];

  const PR_DETAILS_ITEMS = [
    { isCopy: true, label: "Base SHA", value: analysis?.baseSha.slice(0, 7) },
    { isStatus: true, label: "Status", value: analysis?.status },
    { label: "Changed files", value: impact?.summary.affectedFiles ?? 0 },
    { label: "Affected zones", value: impact?.summary.affectedZones ?? 0 },
    {
      label: "Created",
      value: analysis?.createdAt ? String(formatRelativeTime(analysis.createdAt)) : "n/a",
    },
  ];

  const IMPACT_STATS = [
    { label: "Nodes", value: impact?.summary.affectedNodes ?? 0 },
    { label: "Findings", value: impact?.summary.findings ?? 0 },
    { label: "Fixes", value: impact?.summary.linkedFixes ?? 0 },
    {
      label: "Primary View",
      value: impact?.navigationHints.recommendedView ?? "map",
    },
    {
      label: "Total Issues",
      value: analysis?.comments.length ?? 0,
    },
    {
      label: "Generated Fixes",
      value: analysis?.generatedFixes.length ?? 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree />
              Affected Zones
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {affectedZones.length > 0 ? (
              affectedZones.map((zone) => (
                <div key={zone.nodeId} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{zone.label}</p>
                      <p className="text-muted-foreground text-xs">{zone.path}</p>
                    </div>
                    <Badge variant="outline">{zone.impactScore}</Badge>
                  </div>
                  <div className="text-muted-foreground mb-3 flex flex-wrap gap-3 text-xs">
                    <span>{zone.fileCount} files</span>
                    <span>{zone.findingCount} findings</span>
                    <span>{zone.kind}</span>
                    <span>{zone.relatedChangedFiles}</span>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={buildRepoMapHref({ name, nodeId: zone.nodeId, owner })}>
                      <Map /> Open in map
                    </Link>
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                No structural zones were resolved for this PR yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inspect /> Critical Hotspots
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {affectedNodes.length > 0 ? (
              affectedNodes.map((node) => (
                <div key={node.nodeId} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{node.label}</p>
                      <Badge className="text-xs">{node.nodeType}</Badge>
                      <p className="text-muted-foreground text-xs">{node.path}</p>
                    </div>
                    <Badge variant="outline">{node.impactScore}</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{node.whyAffected}</p>
                  <div className="text-muted-foreground mb-3 flex flex-wrap gap-3 text-xs">
                    <span>{node.fileCount} files</span>
                    <span>{node.findingCount} findings</span>
                    <span>{node.kind}</span>
                    <span>{node.relatedChangedFiles}</span>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={buildRepoMapHref({ name, nodeId: node.nodeId, owner })}>
                      <Map /> Open in map
                    </Link>
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                No structural zones were resolved for this PR yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileIcon />
              Changed Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {changedFiles.length > 0 ? (
              changedFiles.map((file) => (
                <div key={file.filePath} className="rounded-xl border p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <code className="text-sm">{file.filePath}</code>
                    <Badge variant="outline">{file.status}</Badge>
                  </div>
                  <div className="text-muted-foreground mb-3 flex flex-wrap gap-3 text-xs">
                    <span className="text-success">+{file.additions}</span>
                    <span className="text-destructive">-{file.deletions}</span>
                    <span>{file.findingCount} findings</span>
                    {file.zoneLabel != null && <span>{file.zoneLabel}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={buildRepoCodeHref({
                          name,
                          nodeId: file.nodeId,
                          owner,
                          path: file.filePath,
                        })}
                      >
                        <FileCode />
                        Code
                      </Link>
                    </Button>
                    {file.zoneId != null && (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={buildRepoMapHref({ name, nodeId: file.zoneId, owner })}>
                          <Map /> Map
                        </Link>
                      </Button>
                    )}
                    {file.nodeId != null && (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={buildRepoDocsHref({ name, nodeId: file.nodeId, owner })}>
                          <FileText /> Docs
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                No changed file snapshot is available.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck />
              Detected Issues ({comments?.renderedComments.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isCommentsLoading ? (
              <Loader2 className="mx-auto animate-spin" />
            ) : comments != null && comments.renderedComments.length > 0 ? (
              <div className="flex flex-col gap-4">
                {comments.renderedComments.map((comment) => (
                  <div key={comment.id} className="rounded-xl border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                        {comment.filePath}:{comment.line}
                      </code>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs font-bold">
                          {comment.findingType}
                        </span>
                        <span className="text-muted-foreground text-xs font-bold">
                          {comment.riskLevel}
                        </span>
                      </div>
                    </div>
                    <article
                      dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
                      className="prose prose-invert prose-pre:p-0 prose-pre:bg-transparent max-w-none min-w-0 text-xs wrap-break-word"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No inline comments were posted for this PR analysis.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold">PR Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {PR_DETAILS_ITEMS.map((item) => (
              <div key={item.label} className="flex items-baseline justify-between">
                <span className="text-muted-foreground text-xs">{item.label}:</span>
                <div className="flex items-center gap-1">
                  {item.isCopy === true && (
                    <CopyButton
                      value={analysis?.baseSha ?? ""}
                      tooltipText="Copy SHA"
                      className="opacity-100"
                    />
                  )}
                  {item.isStatus === true ? (
                    <span
                      className={cn(
                        "font-bold",
                        STATUS_CONFIG[item.value as keyof typeof STATUS_CONFIG].className
                      )}
                    >
                      {STATUS_CONFIG[item.value as keyof typeof STATUS_CONFIG].label}
                    </span>
                  ) : (
                    <span className={cn("text-xs font-medium")}>{item.value}</span>
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
              Impact Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {IMPACT_STATS.map((stat) => (
                <div key={stat.label} className="bg-muted/20 rounded-lg border p-3">
                  <p className="text-muted-foreground mb-1 text-xs font-bold">{stat.label}</p>
                  <p className="text-lg font-black capitalize">{stat.value}</p>
                </div>
              ))}
            </div>

            {impact?.navigationHints.primaryNodeId != null && (
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link
                    href={buildRepoMapHref({
                      name,
                      nodeId: impact.navigationHints.primaryNodeId,
                      owner,
                    })}
                  >
                    <Search /> Inspect primary node
                  </Link>
                </Button>
                {impact.navigationHints.primaryFilePath != null && (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={buildRepoCodeHref({
                        name,
                        nodeId: impact.navigationHints.primaryNodeId,
                        owner,
                        path: impact.navigationHints.primaryFilePath,
                      })}
                    >
                      <FileCode /> Open code
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search />
              Top Findings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topFindings.length > 0 ? (
              topFindings.slice(0, 4).map((finding) => (
                <div key={finding.id} className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{finding.title}</p>
                    <Badge variant="outline">{finding.riskLevel}</Badge>
                  </div>
                  <p className="text-muted-foreground mb-2 text-xs">
                    {finding.filePath}:{finding.line}
                  </p>
                  <article
                    dangerouslySetInnerHTML={{ __html: finding.messageHtml }}
                    className="prose prose-invert prose-pre:p-0 prose-pre:bg-transparent max-w-none min-w-0 text-xs wrap-break-word"
                  />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                No persisted findings are available for this PR analysis.
              </p>
            )}
          </CardContent>
        </Card>

        {fixes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked Fixes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fixes.map((fix) => (
                <div key={fix.id} className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{fix.title}</p>
                    <Badge variant="outline">{fix.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fix.status === "COMPLETED" && (
                      <Button
                        disabled={isStaging}
                        size="sm"
                        variant="outline"
                        onClick={() => stageFix(fix.id)}
                      >
                        Add to PR Draft
                      </Button>
                    )}
                    {fix.githubPrUrl != null && (
                      <ExternalLink href={fix.githubPrUrl}>
                        Open GitHub PR #{fix.githubPrNumber ?? "?"}
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
