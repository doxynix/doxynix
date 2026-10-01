import { AsyncLocalStorage } from "node:async_hooks";

import type { NextRequest } from "next/server";
import ipaddr from "ipaddr.js";

import { IS_PROD } from "@/shared/config/env.flags";
import { APP_VERSION } from "@/shared/config/env.server";

type RequestStore = {
  appVersion?: string;
  country: string;
  ip: null | string;
  method: string;

  origin?: string;
  path: string;
  referer?: string;
  requestId: string;

  userAgent: string;
  userId?: string;
  userRole?: string;
};

export const requestContext = new AsyncLocalStorage<RequestStore>();

// GDPR masking for PG INET: IPv4 zeroes the last octet, IPv6 the last 64 bits.
export function anonymizeIp(ip: null | string | undefined): null | string {
  if (ip == null || ip === "unknown" || ip.trim() === "") {
    return null;
  }

  if (ip === "127.0.0.1" || ip === "::1") {
    return ip;
  }

  try {
    const addr = ipaddr.process(ip);
    const kind = addr.kind();

    if (kind === "ipv4") {
      const ipv4 = addr;
      const octets = ipv4.toByteArray();
      octets[3] = 0;
      return ipaddr.fromByteArray(octets).toString();
    }

    const ipv6 = addr as ipaddr.IPv6;
    const parts = [...ipv6.parts];

    parts[4] = 0;
    parts[5] = 0;
    parts[6] = 0;
    parts[7] = 0;

    return new ipaddr.IPv6(parts).toNormalizedString();
  } catch {
    return null;
  }
}

type VercelRequest = Request & {
  geo?: {
    city?: string;
    country?: string;
    region?: string;
  };
  ip?: string;
};

// Only `headers` plus Vercel's optional `ip`/`geo` are read, never `nextUrl`/`cookies`, so the base `Request` widens the contract safely.
export function getIp(request: Request): string {
  return (
    (request as VercelRequest).ip ??
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    "127.0.0.1"
  );
}

export function getUa(request: Request): string {
  return request.headers.get("user-agent") ?? "unknown";
}

export function getCountry(request: Request): string {
  const geoCountry = (request as VercelRequest).geo?.country;
  if (geoCountry != null) {
    return geoCountry;
  }

  const vercelHeader = request.headers.get("x-vercel-ip-country");
  if (vercelHeader != null) {
    return vercelHeader.toUpperCase();
  }

  if (!IS_PROD) {
    return "LOCAL";
  }

  return "UNKNOWN";
}

type RequestContextInput = {
  method: string;
  path: string;
  req: Request;
  requestId?: string;
  userId?: string;
  userRole?: string;
};

function getRequestIdFromHeaders(request: Request): string | undefined {
  return sanitizeRequestId(request.headers.get("x-request-id"));
}

export function generateRequestId(): string {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  throw new Error("crypto.randomUUID is not available in this runtime");
}

export function sanitizeRequestId(value?: null | string): string | undefined {
  if (value == null) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 64) {
    return undefined;
  }
  if (!/^[\w-]+$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function resolveRequestId(request?: NextRequest, existing?: string): string | undefined {
  if (existing != null) {
    return sanitizeRequestId(existing);
  }
  if (request == null) {
    return undefined;
  }
  return getRequestIdFromHeaders(request);
}

function ensureRequestId(request: Request, existing?: string): string {
  return sanitizeRequestId(existing) ?? getRequestIdFromHeaders(request) ?? generateRequestId();
}

export function buildRequestStore(input: RequestContextInput): RequestStore {
  const requestId = ensureRequestId(input.req, input.requestId);
  return {
    appVersion: APP_VERSION,
    country: getCountry(input.req),
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
