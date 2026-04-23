import { AsyncLocalStorage } from "node:async_hooks";
import type { NextRequest } from "next/server";

import { IS_PROD } from "@/shared/constants/env.flags";

export type RequestStore = {
  ip: string;
  method: string;
  origin?: string;

  path: string;
  referer?: string;
  requestId: string;
  userAgent: string;

  userId?: number;
  userRole?: string;

  // appVersion?: string;
};

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function anonymizeIp(ip: null | string | undefined): string {
  if (ip == null || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return ip ?? "unknown";

  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length < 4) return "unknown";
    return `${parts.slice(0, 4).join(":")}::`;
  }

  return "unknown";
}

type VercelNextRequest = NextRequest & {
  geo?: {
    city?: string;
    country?: string;
    region?: string;
  };
  ip?: string;
};

export function getIp(request: NextRequest): string {
  return (
    (request as VercelNextRequest).ip ??
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    "127.0.0.1"
  );
}

export function getUa(request: NextRequest): string {
  return request.headers.get("user-agent") ?? "unknown";
}

export function getCountry(request: NextRequest): string {
  const geoCountry = (request as VercelNextRequest).geo?.country;
  if (geoCountry != null) return geoCountry;

  const vercelHeader = request.headers.get("x-vercel-ip-country");
  if (vercelHeader != null) return vercelHeader.toUpperCase();

  if (!IS_PROD) return "LOCAL";

  return "UNKNOWN";
}

type RequestContextInput = {
  method: string;
  path: string;
  req: NextRequest;
  requestId?: string;
  userId?: number;
  userRole?: string;
};

export function getRequestIdFromHeaders(request: NextRequest): string | undefined {
  return sanitizeRequestId(request.headers.get("x-request-id"));
}

export function generateRequestId(): string {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  throw new Error("crypto.randomUUID is not available in this runtime");
}

export function sanitizeRequestId(value?: null | string): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return undefined;
  if (!/^[\w-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

export function resolveRequestId(request?: NextRequest, existing?: string): string | undefined {
  if (existing != null) return sanitizeRequestId(existing);
  if (request == null) return undefined;
  return getRequestIdFromHeaders(request);
}

export function ensureRequestId(request: NextRequest, existing?: string): string {
  return sanitizeRequestId(existing) ?? getRequestIdFromHeaders(request) ?? generateRequestId();
}

export function buildRequestStore(input: RequestContextInput): RequestStore {
  const requestId = ensureRequestId(input.req, input.requestId);
  return {
    ip: anonymizeIp(getIp(input.req)),
    method: input.method,
    origin: input.req.headers.get("origin") ?? undefined,
    path: input.path,
    referer: input.req.headers.get("referer") ?? undefined,
    requestId,
    userAgent: getUa(input.req),
    userId: input.userId,
    userRole: input.userRole,
  };
}
