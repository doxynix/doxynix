import { describe, expect, it } from "vitest";

import { isSafeIp } from "./route";

/**
 * The proxy route forwards an attacker-supplied URL to the server, so the
 * request body is the untrusted boundary. Before this was validated it was read
 * with a blind `as ProxyRequestBody`, which let a non-string header value reach
 * undici. The schema itself lives in the route module (it imports
 * `next/server`); these cases pin the SSRF guard that the schema feeds.
 */
describe("proxy route SSRF guard", () => {
  it("rejects loopback", () => {
    expect(isSafeIp("127.0.0.1")).toBe(false);
  });

  it("rejects the unspecified address", () => {
    expect(isSafeIp("0.0.0.0")).toBe(false);
  });

  it("rejects a link-local address", () => {
    expect(isSafeIp("169.254.169.254")).toBe(false);
  });

  it("rejects private ranges", () => {
    expect(isSafeIp("10.0.0.1")).toBe(false);
    expect(isSafeIp("192.168.1.1")).toBe(false);
    expect(isSafeIp("172.16.0.1")).toBe(false);
  });

  it("accepts a public address", () => {
    expect(isSafeIp("8.8.8.8")).toBe(true);
  });

  it("rejects a non-address", () => {
    expect(isSafeIp("not-an-ip")).toBe(false);
  });
});
