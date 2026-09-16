import { describe, expect, it } from "vitest";

import { getThemeTransitionClipPaths, type TransitionVariant } from "./theme-transition";

describe("getThemeTransitionClipPaths", () => {
  it("builds circle paths from the given center and radius", () => {
    expect(getThemeTransitionClipPaths("circle", 100, 50, 10, 800, 600)).toEqual([
      "circle(0px at 100px 50px)",
      "circle(10px at 100px 50px)",
    ]);
  });

  it("defaults unknown variants to a circle reveal", () => {
    expect(getThemeTransitionClipPaths("blob" as TransitionVariant, 0, 0, 5, 0, 0)).toEqual([
      "circle(0px at 0px 0px)",
      "circle(5px at 0px 0px)",
    ]);
  });

  it("collapses polygons to the center point for multiple variants", () => {
    const collapsed = "polygon(100px 50px, 100px 50px, 100px 50px, 100px 50px)";
    expect(getThemeTransitionClipPaths("square", 100, 50, 10, 800, 600)[0]).toBe(collapsed);
    expect(getThemeTransitionClipPaths("rectangle", 100, 50, 10, 800, 600)[0]).toBe(collapsed);
    expect(getThemeTransitionClipPaths("diamond", 100, 50, 10, 800, 600)[0]).toBe(collapsed);
  });

  it("collapses triangle to three, hexagon to six center points", () => {
    const triangle = "polygon(100px 50px, 100px 50px, 100px 50px)";
    const hexagon =
      "polygon(100px 50px, 100px 50px, 100px 50px, 100px 50px, 100px 50px, 100px 50px)";
    expect(getThemeTransitionClipPaths("triangle", 100, 50, 10, 800, 600)[0]).toBe(triangle);
    expect(getThemeTransitionClipPaths("hexagon", 100, 50, 10, 800, 600)[0]).toBe(hexagon);
  });

  it("spreads square and rectangle to cover the viewport axes", () => {
    const [start, end] = getThemeTransitionClipPaths("square", 100, 50, 10, 800, 600);
    expect(end).toMatch(/polygon\(-?[0-9.]+px -?[0-9.]+px, .+\)/);
    expect(end).not.toBe(start);
    expect(end).toContain("-635px -685px");
  });

  it("expands the star from a tiny polygon to the overscanned radius", () => {
    const [start, end] = getThemeTransitionClipPaths("star", 100, 50, 10, 800, 600);
    expect(start).toMatch(/^polygon\((.+, ){9}.+px\)$/);
    expect(end).toMatch(/^polygon\((.+, ){9}.+px\)$/);
    expect(start).not.toBe(end);
    expect(end.length).toBeGreaterThan(start.length);
  });
});
