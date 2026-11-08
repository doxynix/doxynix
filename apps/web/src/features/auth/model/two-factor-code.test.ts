import { describe, expect, it } from "vitest";

import { BACKUP_CODE_LENGTH, codeLengthFor } from "./two-factor-code";

describe("codeLengthFor", () => {
  it("expects six digits for TOTP", () => {
    expect(codeLengthFor(false)).toBe(6);
  });

  it("switches to the backup length in backup mode", () => {
    expect(codeLengthFor(true)).toBe(BACKUP_CODE_LENGTH);
  });

  it("matches the Better Auth backup code format", () => {
    // Better Auth renders ten random characters as `XXXXX-XXXXX`; the hyphen counts.
    expect("XXXXX-XXXXX").toHaveLength(BACKUP_CODE_LENGTH);
  });
});
