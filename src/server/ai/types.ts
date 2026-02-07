export type LanguageMetric = {
  name: string;
  lines: number;
  color: string;
};

export type RepoMetrics = {
  totalLoc: number;
  fileCount: number;
  totalSizeKb: number;
  languages: LanguageMetric[];
  techDebtScore: number;
  complexityScore: number;
  busFactor: number;
  mostComplexFiles: string[];
  onboardingScore: number;
  maintenanceStatus: "active" | "stale" | "dead";
  healthScore: number;
};
