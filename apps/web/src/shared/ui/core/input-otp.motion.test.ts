import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const otp = readFileSync(join(process.cwd(), "src/shared/ui/core/input-otp.tsx"), "utf8");

describe("otp input motion", () => {
  it("never uses transition-all", () => {
    expect(otp).not.toContain("transition-all");
  });

  it("names the properties it animates", () => {
    expect(otp).toContain("transition-[border-color,box-shadow]");
  });
});
