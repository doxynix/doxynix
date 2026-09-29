// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));

vi.mock("@/shared/ui/core/card", () => ({
  Card: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CardContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CardDescription: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CardHeader: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CardTitle: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("./analytics-chart-lazy", () => ({
  LazyAnalyticsChart: () => createElement("div", { "data-testid": "lazy-analytics-chart" }),
}));

vi.mock("./analytics-chart", () => ({
  AnalyticsChart: () => createElement("div", { "data-testid": "eager-analytics-chart" }),
}));

import { AnalyticsSection } from "./analytics-section";

describe("AnalyticsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the lazy boundary, not the chart directly", async () => {
    render(await AnalyticsSection());

    await expect(screen.findByTestId("lazy-analytics-chart")).resolves.not.toBeNull();
    expect(screen.queryByTestId("eager-analytics-chart")).toBeNull();
  });
});
