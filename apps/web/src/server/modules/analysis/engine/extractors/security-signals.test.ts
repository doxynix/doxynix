import { describe, expect, it } from "vitest";

import { collectAstSecurityFindings } from "./security-signals";

describe("collectAstSecurityFindings", () => {
  it("flags a real eval call but not a string or comment", async () => {
    const findings = await collectAstSecurityFindings({
      content: ['const text = "eval(userInput)";', "// eval(userInput)", "eval(userInput);"].join(
        "\n",
      ),
      path: "src/a.ts",
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual(expect.objectContaining({ line: 3, severity: "warning" }));
  });

  it("flags child_process.exec", async () => {
    const findings = await collectAstSecurityFindings({
      content: 'import { exec } from "child_process";\nexec("rm -rf /");',
      path: "src/b.ts",
    });

    expect(findings).toHaveLength(1);
  });
});
