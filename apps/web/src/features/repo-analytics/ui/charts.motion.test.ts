import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const files = [
  "src/features/repo-analytics/ui/repo-trends-chart.tsx",
  "src/features/manage-subscription/ui/usage-forecast-chart.tsx",
  "src/entities/repo/ui/repo-quality-radar.tsx",
  "src/entities/repo/ui/repo-complexity-scatter-chart.tsx",
];

describe("dashboard charts", () => {
  for (const file of files) {
    it(`renders ${file} without a mount animation`, () => {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const series = source.match(/<(Area|Radar|Scatter)\b/g) ?? [];
      const disabled = source.match(/isAnimationActive=\{false\}/g) ?? [];
      expect(series.length).toBeGreaterThan(0);
      expect(disabled.length).toBe(series.length);
    });
  }

  it("leaves the marketing chart animated", () => {
    const landing = readFileSync(
      join(process.cwd(), "src/widgets/landing/ui/analytics-chart.tsx"),
      "utf8",
    );
    expect(landing).not.toContain("isAnimationActive={false}");
  });
});
