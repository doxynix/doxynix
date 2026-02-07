import sloc, { Extension } from "sloc";

import { getLanguageColor } from "@/entities/repo";
import { Repo } from "@/generated/zod";
import { LanguageMetric, RepoMetrics } from "../ai/types";

function calculateDocDensity(source: number, comment: number): number {
  if (source === 0) return 0;
  return Math.round((comment / (source + comment)) * 100);
}

function calculateModularity(totalLoc: number, fileCount: number): number {
  if (fileCount === 0) return 0;
  const avgLines = totalLoc / fileCount;
  return Math.max(0, Math.min(100, 100 - avgLines / 5));
}

export function calculateHealthScore(repo: Repo, busFactor: number, docDensity: number): number {
  let score = 50;

  const lastPushDate = repo.pushedAt ? new Date(repo.pushedAt) : new Date();
  const monthsSincePush = (Date.now() - lastPushDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsSincePush < 1) score += 20;
  else if (monthsSincePush > 6) score -= 30;

  if (busFactor > 2) score += 15;
  if (busFactor === 1) score -= 15;

  if (docDensity > 15) score += 15;
  if (docDensity < 5) score -= 10;

  return Math.max(0, Math.min(100, score));
}

export function calculateCodeMetrics(files: { path: string; content: string }[]): Omit<
  RepoMetrics,
  "busFactor" | "healthScore" | "onboardingScore" | "maintenanceStatus"
> & {
  docDensity: number;
  modularityIndex: number;
} {
  let totalSource = 0;
  let totalComments = 0;
  let totalSize = 0;
  const langStats: Record<string, number> = {};

  files.forEach((f) => {
    totalSize += f.content.length;
    const ext = f.path.split(".").pop()?.toLowerCase() ?? "txt";

    try {
      if (sloc.extensions.includes(ext as Extension)) {
        const stats = sloc(f.content, ext as Extension);
        totalSource += stats.source;
        totalComments += stats.comment;
        langStats[ext] = (langStats[ext] || 0) + stats.source;
      } else {
        const lines = f.content.split("\n").length;
        totalSource += lines;
        langStats["other"] = (langStats["other"] || 0) + lines;
      }
    } catch {
      const lines = f.content.split("\n").length;
      totalSource += lines;
      langStats[ext] = (langStats[ext] || 0) + lines;
    }
  });

  const languages: LanguageMetric[] = Object.entries(langStats)
    .map(([ext, lines]) => ({
      name: ext.toUpperCase(),
      lines,
      color: getLanguageColor(ext) || "#cccccc",
    }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 6);

  const docDensity = calculateDocDensity(totalSource, totalComments);
  const modularityIndex = calculateModularity(totalSource, files.length);

  return {
    totalLoc: totalSource + totalComments,
    fileCount: files.length,
    totalSizeKb: Math.round(totalSize / 1024),
    languages,
    docDensity,
    modularityIndex,
    techDebtScore: 0,
    complexityScore: 0,
    mostComplexFiles: [],
  };
}

export function calculateTeamRoles(contributors: { login: string; contributions: number }[]) {
  const total = contributors.reduce((acc, c) => acc + c.contributions, 0);

  return contributors
    .map((c) => {
      const share = (c.contributions / total) * 100;
      let role = "Contributor";

      if (share > 50) role = "Project Guardian";
      else if (share > 20) role = "Key Architect";
      else if (share > 5) role = "Active Maintainer";

      return {
        login: c.login,
        share: Math.round(share),
        role,
      };
    })
    .slice(0, 5);
}
