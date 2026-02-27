import { AsyncLocalStorage } from "node:async_hooks";
import type { NextRequest } from "next/server";

import { IS_PROD } from "@/shared/constants/env.client";

export interface RequestStore {
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
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function anonymizeIp(ip: string | undefined | null): string {
  if (ip == null || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return ip ?? "unknown";

  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  if (ip.includes(":")) {
    const parts = ip.split(":");
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
