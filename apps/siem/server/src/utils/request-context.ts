import type { Context } from "hono";

export type RequestContext = {
  country: string;
  ip: string;
  method: string;
  origin?: string | undefined;
  path: string;
  referer?: string | undefined;
  requestId: string;
  userAgent: string;
  userId?: string | undefined;
  userRole?: string | undefined;
};

export function getCountry(c: Context) {
  return (
    c.req.header("cf-ipcountry") ??
    c.req.header("x-vercel-ip-country") ??
    "UNKNOWN"
  ).toUpperCase();
}

export function getRequestId(c: Context) {
  return c.get("requestId") ?? c.req.header("x-request-id") ?? "unknown";
}

export function getIp(c: Context) {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "127.0.0.1"
  ).replace(/[^a-zA-Z0-9:._-]/g, "");
}

export function getRequestContext(c: Context): RequestContext {
  return {
    country: getCountry(c),
    ip: getIp(c),
    method: c.req.method,
    origin: c.req.header("origin") ?? undefined,
    path: c.req.path,
    referer: c.req.header("referer") ?? undefined,
    requestId: getRequestId(c),
    userAgent: c.req.header("user-agent") ?? "unknown",
    userId: c.get("user")?.id ?? undefined,
    userRole: c.get("user")?.role ?? undefined,
  };
}
