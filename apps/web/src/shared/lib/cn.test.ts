import { describe, expect, it } from "vitest";

import { cn } from "@/shared/lib/cn";

describe("shared/lib/utils:cn", () => {
  it("should merge classes and keep last tailwind conflict", () => {
    const className = cn("p-2", "text-sm", "p-4", "bg-muted", "bg-foreground");

    expect(className).toContain("p-4");
    expect(className).toContain("bg-foreground");
    expect(className).not.toContain("bg-muted");
    expect(className).not.toContain("p-2");
  });
});
