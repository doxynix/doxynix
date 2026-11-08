import { describe, expect, it } from "vitest";

import { EASING } from "@/shared/config/motion";

import {
  defaultItemAnimationVariants,
  ENTER_DURATION,
  ENTER_EASING,
  EXIT_DURATION,
  EXIT_EASING,
  withTastefulEasing,
} from "./text-animate.variants";

describe("withTastefulEasing", () => {
  it("adds expo-out easing and bumps short enter durations", () => {
    expect(withTastefulEasing({ duration: 0.3 }, "enter")).toEqual({
      duration: ENTER_DURATION,
      ease: [...ENTER_EASING],
    });
  });

  it("caps exit durations at the fast threshold", () => {
    expect(withTastefulEasing({ duration: 0.3 }, "exit")).toEqual({
      duration: EXIT_DURATION,
      ease: [...EXIT_EASING],
    });
  });

  it("leaves per-property transitions (springs) untouched", () => {
    const input = { scale: { damping: 15, stiffness: 300, type: "spring" } };
    expect(withTastefulEasing(input, "enter")).toBe(input);
  });

  it("applies tasteful easing to the hero presets", () => {
    const hero = defaultItemAnimationVariants.blurIn.item;
    const show = hero.show as { transition?: { ease?: unknown; duration?: number } };
    const exit = hero.exit as { transition?: { ease?: unknown; duration?: number } };
    expect(show.transition).toMatchObject({ ease: [...ENTER_EASING] });
    expect(exit.transition).toMatchObject({ ease: [...EXIT_EASING] });
  });
});

describe("tasteful entrances", () => {
  it("never enters from a half-size element", () => {
    const scaleUp = defaultItemAnimationVariants.scaleUp.item.hidden as { scale?: number };
    const scaleDown = defaultItemAnimationVariants.scaleDown.item.hidden as { scale?: number };
    expect(scaleUp.scale).toBeGreaterThanOrEqual(0.9);
    expect(scaleDown.scale).toBeLessThanOrEqual(1.1);
  });

  it("exits on the same curve it enters with", () => {
    expect([...EXIT_EASING]).toEqual([...EASING.out]);
  });

  it("keeps every entrance duration under a second", () => {
    for (const { item } of Object.values(defaultItemAnimationVariants)) {
      const show = item.show as { transition?: { duration?: number } };
      expect(show.transition?.duration ?? 0).toBeLessThanOrEqual(0.5);
    }
  });
});
