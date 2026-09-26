import { describe, expect, it } from "vitest";

import { mergePrBody } from "./pr-body";

const START = "<!-- DOXYNIX_START -->";
const END = "<!-- DOXYNIX_END -->";

describe("mergePrBody", () => {
  it("writes only the marked block when there is no existing body", () => {
    expect(mergePrBody(null, "summary")).toBe(`${START}\n\nsummary\n\n${END}`);
  });

  it("writes only the marked block when the existing body is blank", () => {
    expect(mergePrBody("   \n  ", "summary")).toBe(`${START}\n\nsummary\n\n${END}`);
  });

  it("appends below existing prose separated by a horizontal rule", () => {
    expect(mergePrBody("## Description", "summary")).toBe(
      `## Description\n\n---\n\n${START}\n\nsummary\n\n${END}`,
    );
  });

  it("replaces a previous summary in place", () => {
    const existing = `intro\n\n${START}\n\nold\n\n${END}\n\nfooter`;

    expect(mergePrBody(existing, "new")).toBe(`intro\n\n${START}\n\nnew\n\n${END}\n\nfooter`);
  });

  it("keeps prose written after the end marker", () => {
    const existing = `${START}\n\nold\n\n${END}\n\n## Checklist\n- [ ] x`;

    expect(mergePrBody(existing, "new")).toBe(`${START}\n\nnew\n\n${END}\n\n## Checklist\n- [ ] x`);
  });

  it("is idempotent across repeated analyses", () => {
    const first = mergePrBody(null, "one");
    const second = mergePrBody(first, "two");
    const third = mergePrBody(second, "three");

    expect(third).toBe(`${START}\n\nthree\n\n${END}`);
    expect(third).not.toContain("one");
    expect(third).not.toContain("two");
  });

  it("does not treat a reversed marker pair as a replaceable block", () => {
    const existing = `${END}\n\nreversed\n\n${START}`;

    expect(mergePrBody(existing, "new")).toBe(`${existing}\n\n---\n\n${START}\n\nnew\n\n${END}`);
  });

  it("appends when only one marker is present", () => {
    expect(mergePrBody(`orphan ${START}`, "new")).toBe(
      `orphan ${START}\n\n---\n\n${START}\n\nnew\n\n${END}`,
    );
  });
});
