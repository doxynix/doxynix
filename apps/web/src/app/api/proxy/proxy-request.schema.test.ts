import { describe, expect, it } from "vitest";

import { ProxyRequestBody } from "./proxy-request.schema";

describe("ProxyRequestBody", () => {
  it("accepts a minimal body with just a url and method", () => {
    const parsed = ProxyRequestBody.safeParse({ method: "GET", url: "https://example.com" });

    expect(parsed.success).toBe(true);
  });

  it("accepts string header values", () => {
    const parsed = ProxyRequestBody.safeParse({
      headers: { "x-trace": "abc" },
      method: "POST",
      url: "https://example.com",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a non-string header value, which undici cannot send", () => {
    const parsed = ProxyRequestBody.safeParse({
      headers: { "x-trace": { nested: true } },
      method: "GET",
      url: "https://example.com",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a numeric header value", () => {
    expect(
      ProxyRequestBody.safeParse({ headers: { "x-retry": 3 }, method: "GET", url: "https://e.com" })
        .success,
    ).toBe(false);
  });

  it("leaves body opaque, since it is forwarded verbatim", () => {
    const body = { anything: [1, 2, 3] };
    const parsed = ProxyRequestBody.safeParse({ body, method: "POST", url: "https://example.com" });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.body).toEqual(body);
  });

  it("rejects a non-string url", () => {
    expect(ProxyRequestBody.safeParse({ method: "GET", url: 5 }).success).toBe(false);
  });

  it("rejects a non-string method", () => {
    expect(ProxyRequestBody.safeParse({ method: ["GET"], url: "https://e.com" }).success).toBe(
      false,
    );
  });

  it("treats a missing body as absent rather than a type error", () => {
    expect(ProxyRequestBody.safeParse({ method: "GET", url: "https://e.com" }).success).toBe(true);
  });
});
