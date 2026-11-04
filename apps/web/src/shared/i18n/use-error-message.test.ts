import { MessageCode } from "@doxynix/shared";
import { describe, expect, it } from "vitest";

import { ERROR_MESSAGE_KEYS, messageKeyFor, readErrorPayload } from "./use-error-message";

describe("messageKeyFor", () => {
  it("has a key for every message code", () => {
    expect(Object.keys(ERROR_MESSAGE_KEYS).sort()).toEqual(Object.values(MessageCode).sort());
  });

  it("lowercases the code into a snake_case key", () => {
    expect(messageKeyFor("REPO_NOT_FOUND")).toBe("repo_not_found");
  });
});

describe("readErrorPayload", () => {
  it("reads messageCode and params from a tRPC-shaped error", () => {
    const payload = readErrorPayload({
      data: { messageCode: "GITHUB_APP_NOT_INSTALLED_OWNER", params: { owner: "acme" } },
      message: "GitHub App is not installed for acme.",
    });

    expect(payload).toEqual({
      message: "GitHub App is not installed for acme.",
      messageCode: "GITHUB_APP_NOT_INSTALLED_OWNER",
      params: { owner: "acme" },
    });
  });

  it("ignores unknown codes", () => {
    const payload = readErrorPayload({ data: { messageCode: "NOT_A_CODE" } });

    expect(payload.messageCode).toBeUndefined();
  });

  it("survives non-object input", () => {
    expect(readErrorPayload("boom")).toEqual({});
  });
});
