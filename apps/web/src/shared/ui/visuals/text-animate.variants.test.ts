import { describe, expect, it } from "vitest";

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
