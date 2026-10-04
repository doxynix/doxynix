import { describe, expect, it } from "vitest";

import { SENTRY_REPLAY_INTEGRATION_OPTIONS } from "./sentry-replay";

describe("SENTRY_REPLAY_INTEGRATION_OPTIONS", () => {
  it("masks all text and all inputs", () => {
    expect(SENTRY_REPLAY_INTEGRATION_OPTIONS.maskAllInputs).toBe(true);
    expect(SENTRY_REPLAY_INTEGRATION_OPTIONS.maskAllText).toBe(true);
  });

  it("blocks all media", () => {
    expect(SENTRY_REPLAY_INTEGRATION_OPTIONS.blockAllMedia).toBe(true);
  });
});
