export type LanguageMetric = {
  color: string;
  lines: number;
  name: string;
};

export type RepoMetrics = {
  busFactor: number;
  complexityScore: number;
  fileCount: number;
  healthScore: number;
  languages: LanguageMetric[];
  maintenanceStatus: "active" | "stale" | "dead";
  mostComplexFiles: string[];
  onboardingScore: number;
  techDebtScore: number;
  totalLoc: number;
  totalSizeKb: number;
};
