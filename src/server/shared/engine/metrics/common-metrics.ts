import simpleGit from "simple-git";

import { logger } from "../../infrastructure/logger";
import type { ChurnHotspot, TeamRole } from "../../types";
import { normalizeRepoPath } from "../core/common";
import type { ChangeCouplingRef } from "../core/discovery.types";
import { ProjectPolicy } from "../core/project-policy";

export type SimplifiedRepoMetrics = {
  complexityScore: number;
  docDensity: number;
  fileCount: number;
  languages: Array<{ color: string; lines: number; name: string }>;
  modularityIndex: number;
  mostComplexFiles: string[];
  techDebtScore: number;
  totalLoc: number;
  totalSizeKb: number;
};

export async function calculateCodeMetrics(
  files: { content: string; path: string }[]
): Promise<SimplifiedRepoMetrics> {
  if (files.length === 0) {
    return {
      complexityScore: 0,
      docDensity: 0,
      fileCount: 0,
      languages: [],
      modularityIndex: 0,
      mostComplexFiles: [],
      techDebtScore: 0,
      totalLoc: 0,
      totalSizeKb: 0,
    };
  }

  const { calculateCodeMetrics: calculateFullCodeMetrics } = await import("./code-metrics");
  const metrics = await calculateFullCodeMetrics(files);

  return {
    complexityScore: metrics.complexityScore,
    docDensity: metrics.docDensity,
    fileCount: metrics.fileCount,
    languages: metrics.languages,
    modularityIndex: metrics.modularityIndex,
    mostComplexFiles: metrics.mostComplexFiles,
    techDebtScore: metrics.techDebtScore,
    totalLoc: metrics.totalLoc,
    totalSizeKb: metrics.totalSizeKb,
  };
}

export function calculateTeamRoles(
  contributors: { contributions: number; login: string }[]
): TeamRole[] {
  const total = contributors.reduce((sum, contributor) => sum + contributor.contributions, 0);
  if (total === 0) return [];

  return contributors
    .map((contributor) => {
      const share = (contributor.contributions / total) * 100;
      let role = "Contributor";

      if (share > 50) role = "Project Guardian";
      else if (share > 20) role = "Key Architect";
      else if (share > 5) role = "Active Maintainer";

      return {
        login: contributor.login,
        role,
        share: Math.round(share),
      };
    })
    .sort((left, right) => right.share - left.share);
}

const WINDOW_DAYS = 90;

export async function computeGitChurnHotspots(
  repoRoot: string,
  relativePaths: string[]
): Promise<ChurnHotspot[]> {
  const allowed = new Set(relativePaths.map((p) => normalizeRepoPath(p)));
  if (allowed.size === 0) return [];

  try {
    const git = simpleGit(repoRoot);
    const out = await git.raw([
      "log",
      `--since=${WINDOW_DAYS} days ago`,
      "--name-only",
      "--pretty=format:",
    ]);

    const counts = new Map<string, number>();
    for (const line of out.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      const norm = normalizeRepoPath(trimmed);
      if (!allowed.has(norm)) continue;
      counts.set(norm, (counts.get(norm) ?? 0) + 1);
    }

    const maxCommits = Math.max(1, ...counts.values());
    return [...counts.entries()]
      .map(([filePath, commitsInWindow]) => ({
        churnScore: Math.round((commitsInWindow / maxCommits) * 100),
        commitsInWindow,
        path: filePath,
      }))
      .sort((a, b) => b.commitsInWindow - a.commitsInWindow);
  } catch (error) {
    logger.debug({
      error,
      msg: "Git churn hotspot calculation skipped after git failure",
      repoRoot,
      trackedPathCount: allowed.size,
    });
    return [];
  }
}

export async function computeChangeCoupling(
  repoRoot: string,
  relativePaths: string[]
): Promise<ChangeCouplingRef[]> {
  const allowed = new Set(relativePaths.map((p) => normalizeRepoPath(p)));
  if (allowed.size === 0) return [];

  try {
    const git = simpleGit(repoRoot);
    const out = await git.raw([
      "log",
      "--since=180 days ago",
      "--name-only",
      "--pretty=format:--commit--",
    ]);

    const pairCounts = new Map<string, number>();
    let currentCommitFiles = new Set<string>();

    const flushCommit = () => {
      const files = Array.from(currentCommitFiles).sort((left, right) => left.localeCompare(right));
      if (files.length < 2) {
        currentCommitFiles = new Set<string>();
        return;
      }

      for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
          const left = files[i]!;
          const right = files[j]!;
          const key = `${left}::${right}`;
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }

      currentCommitFiles = new Set<string>();
    };

    for (const line of out.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (trimmed === "--commit--") {
        flushCommit();
        continue;
      }
      if (trimmed.length === 0) continue;
      const norm = normalizeRepoPath(trimmed);
      if (!allowed.has(norm)) continue;
      if (!ProjectPolicy.isArchitectureRelevant(norm)) continue;
      currentCommitFiles.add(norm);
    }

    flushCommit();

    return [...pairCounts.entries()]
      .map(([key, commits]) => {
        const [fromPath, toPath] = key.split("::");
        return { commits, fromPath, toPath };
      })
      .filter((item) => item.commits >= 2)
      .sort((left, right) => right.commits - left.commits)
      .slice(0, 24);
  } catch (error) {
    logger.debug({
      error,
      msg: "Change coupling calculation skipped after git failure",
      repoRoot,
      trackedPathCount: allowed.size,
    });
    return [];
  }
}
