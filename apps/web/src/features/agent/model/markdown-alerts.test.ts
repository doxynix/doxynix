import { describe, expect, it } from "vitest";

import { matchAlertPragma } from "./markdown-alerts";

describe("matchAlertPragma", () => {
  it("matches every alert type case-insensitively", () => {
    expect(matchAlertPragma("[!note] text")?.type).toBe("NOTE");
    expect(matchAlertPragma("[!WARNING]")?.type).toBe("WARNING");
    expect(matchAlertPragma("[!Tip]")?.type).toBe("TIP");
    expect(matchAlertPragma("[!Important]")?.type).toBe("IMPORTANT");
    expect(matchAlertPragma("[!caution]")?.type).toBe("CAUTION");
  });

  it("reports the matched length including trailing whitespace", () => {
    expect(matchAlertPragma("[!NOTE] text")).toEqual({ matchedLength: 8, type: "NOTE" });
    expect(matchAlertPragma("[!tip]")).toEqual({ matchedLength: 6, type: "TIP" });
    expect(matchAlertPragma("[!important] text")).toEqual({ matchedLength: 13, type: "IMPORTANT" });
  });

  it("consumes leading and trailing quote variants", () => {
    expect(matchAlertPragma('"[!note]"')).toEqual({ matchedLength: 9, type: "NOTE" });
    expect(matchAlertPragma("'[!caution]'")).toEqual({ matchedLength: 12, type: "CAUTION" });
    expect(matchAlertPragma("“[!tip]”")).toEqual({ matchedLength: 8, type: "TIP" });
    expect(matchAlertPragma(" [!note]")).toEqual({ matchedLength: 8, type: "NOTE" });
  });

  it("returns null when there is no pragma at the start", () => {
    expect(matchAlertPragma("plain text")).toBeNull();
    expect(matchAlertPragma("before [!note] after")).toBeNull();
    expect(matchAlertPragma("[!invalid]")).toBeNull();
    expect(matchAlertPragma("")).toBeNull();
  });
});
