import { describe, expect, it } from "vitest";
import * as z from "zod/mini";

import { validateField } from "./validation";

describe("validateField", () => {
  it("returns undefined for valid values", () => {
    expect(validateField(z.string())("hello")).toBeUndefined();
  });

  it("returns the first validation issue message for invalid values", () => {
    const schema = z.string();
    const result = validateField(schema)(123);
    expect(result).toBe("Invalid input");
  });
});
