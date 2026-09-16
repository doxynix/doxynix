import { describe, expect, it } from "vitest";

import {
  COMPLEXITY_SCORING,
  STRUCTURAL_MODULARITY_SCORING,
  TECH_DEBT_SCORING,
  validateScoringConstants,
} from "./scoring-constants";

describe("validateScoringConstants", () => {
  it("reports no problems for the configured penalty values", () => {
    expect(validateScoringConstants()).toEqual([]);
  });

  it("validated penalty maxima stay within the 0-100 range", () => {
    expect(COMPLEXITY_SCORING.averagePenaltyMax).toBeGreaterThanOrEqual(0);
    expect(COMPLEXITY_SCORING.averagePenaltyMax).toBeLessThanOrEqual(100);
    expect(TECH_DEBT_SCORING.duplicationPenaltyMax).toBeLessThanOrEqual(100);
    expect(STRUCTURAL_MODULARITY_SCORING.cyclePenaltyMax).toBeLessThanOrEqual(100);
  });
});
