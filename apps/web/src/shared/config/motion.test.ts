import { describe, expect, it } from "vitest";

import { DURATION, EASING, SCALE } from "./motion";

describe("motion contract", () => {
  it("keeps every curve inside the 0..1 control-point box", () => {
    for (const curve of [EASING.out, EASING.inOut, EASING.drawer, EASING.expoOut]) {
      expect(curve).toHaveLength(4);
      expect(curve.every((n) => n >= 0 && n <= 1)).toBe(true);
    }
  });

  it("keeps UI durations inside the 300ms budget", () => {
    expect(DURATION.press).toBeLessThanOrEqual(160);
    expect(DURATION.ui).toBeLessThanOrEqual(200);
    expect(DURATION.tooltip).toBeLessThanOrEqual(200);
    expect(DURATION.dropdown).toBeLessThanOrEqual(250);
    expect(DURATION.modalOpen).toBeLessThanOrEqual(300);
    expect(DURATION.modalClose).toBeLessThanOrEqual(250);
    expect(DURATION.hoverDim).toBeLessThanOrEqual(150);
    expect(DURATION.chart).toBe(0);
  });

  it("keeps entrance scales off zero", () => {
    expect(SCALE.enter).toBeGreaterThanOrEqual(0.9);
    expect(SCALE.enter).toBeLessThanOrEqual(0.97);
    expect(SCALE.press).toBeGreaterThanOrEqual(0.95);
    expect(SCALE.press).toBeLessThanOrEqual(0.98);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

const cubic = (values: readonly number[]) => `cubic-bezier(${values.join(", ")})`;

describe("globals.css mirrors the motion contract", () => {
  it("declares the strong ease-out curve", () => {
    expect(css).toContain(`--ease-out: ${cubic(EASING.out)}`);
  });

  it("declares the ease-in-out and drawer curves", () => {
    expect(css).toContain(`--ease-in-out: ${cubic(EASING.inOut)}`);
    expect(css).toContain(`--ease-drawer: ${cubic(EASING.drawer)}`);
  });

  it("routes bare transitions through the strong curve", () => {
    expect(css).toContain(`--default-transition-timing-function: ${cubic(EASING.out)}`);
  });

  it("does not animate box-shadow by default", () => {
    const utility = css.slice(css.indexOf("@utility transition-standard"));
    const propertyList = utility.slice(0, utility.indexOf("}"));
    expect(propertyList).not.toContain("box-shadow");
  });

  it("keeps the fade entrances inside the budget", () => {
    expect(css).toContain("--animate-fade-in: fade-in 200ms");
    expect(css).toContain("--animate-fade-out: fade-out 150ms");
  });
});

describe("reduced motion", () => {
  it("never collapses every transition to 0.01ms", () => {
    expect(css).not.toMatch(/transition-duration:\s*0\.01ms/);
  });

  it("keeps colour and opacity transitions under reduced motion", () => {
    expect(css).toContain(
      "transition-property: color, background-color, border-color, outline-color, opacity !important;",
    );
    expect(css).toContain("transition-duration: 120ms !important;");
  });

  it("stops the decorative loops", () => {
    expect(css).toContain(".animate-marquee");
    expect(css).toContain(".shimmer");
    expect(css).toContain("animation: none !important;");
  });
});
