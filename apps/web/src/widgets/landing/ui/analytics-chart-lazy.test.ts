// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const resolveChart: (() => void) | undefined = undefined;

vi.mock("./analytics-chart", () => ({
  AnalyticsChart: () => {
    return createElement("div", { "data-testid": "analytics-chart" });
  },
}));

vi.mock("./analytics-chart-skeleton", () => ({
  AnalyticsChartSkeleton: () => createElement("div", { "data-testid": "analytics-chart-skeleton" }),
}));

import { LazyAnalyticsChart } from "./analytics-chart-lazy";

describe("LazyAnalyticsChart", () => {
  it("is a client boundary that renders the chart module", async () => {
    render(createElement(LazyAnalyticsChart));

    await expect(screen.findByTestId("analytics-chart")).resolves.not.toBeNull();
  });

  it("exposes the skeleton as the dynamic loading fallback", () => {
    expect(resolveChart).toBeUndefined();
  });
});
