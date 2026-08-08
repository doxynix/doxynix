export const SEVERITY_LEVELS = ["low", "medium", "high", "critical"] as const;

export type Severity = (typeof SEVERITY_LEVELS)[number];

export type LeakFinding = {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  matchedText: string;
  line: number;
};

export type ScanResult = {
  isSafe: boolean;
  findings?: LeakFinding[];
  message: string;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: PaginationMeta;
};
