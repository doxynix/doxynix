import { brand } from "./colors";

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return brand.muted("—");
  }
  if (score >= 80) {
    return brand.success(`${score}/100`);
  }
  if (score >= 50) {
    return brand.warning(`${score}/100`);
  }
  return brand.error(`${score}/100`);
}

export function getScoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return brand.muted("No data");
  }
  if (score >= 80) {
    return brand.success("Excellent");
  }
  if (score >= 50) {
    return brand.warning("Needs Attention");
  }
  return brand.error("Critical");
}
