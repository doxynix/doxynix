import { readFileSync } from "node:fs";

import { join } from "pathe";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(join(import.meta.dirname, "workspace.router.ts"), "utf8");
const membersPageSource = readFileSync(
  join(import.meta.dirname, "../../../features/workspace/ui/workspace-members-page.tsx"),
  "utf8",
);

describe("workspace billing entry points", () => {
  it("does not expose a local upgrade mutation", () => {
    expect(routerSource).not.toContain("upgradeToPro");
  });

  it("sends the members CTA to the billing screen instead of calling a mutation", () => {
    expect(membersPageSource).toContain("/dashboard/settings/billing");
    expect(membersPageSource).not.toContain("upgradeToPro");
    expect(membersPageSource).not.toContain("upgrade.mutate");
  });
});
