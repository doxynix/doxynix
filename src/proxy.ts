import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { redisClient } from "./server/lib/redis";
import { IS_PROD } from "./shared/constants/env.client";
import { TURNSTILE_SECRET_KEY } from "./shared/constants/env.server";
import { LOCALE_REGEX_STR } from "./shared/constants/locales";
import { logger } from "./shared/lib/logger";
import { getCookieName } from "./shared/lib/utils";

const ONE_MB = 1024 * 1024;
const protectedRoutes = ["/dashboard"];
const authRoutes = ["/auth"];
const cookieName = getCookieName();

let ratelimit: Ratelimit | null = null;
if (IS_PROD) {
  ratelimit = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(20, "10 s"),
    analytics: false,
    prefix: "@upstash/ratelimit",
  });
}

const intlMiddleware = createMiddleware(routing);

type VercelNextRequest = NextRequest & {
  ip?: string;
  geo?: {
    country?: string;
    city?: string;
    region?: string;
  };
};

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hashBuffer).toString("hex");
}

function getIp(request: NextRequest): string {
  return (
    (request as VercelNextRequest).ip ??
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    "127.0.0.1"
  );
}

function getUa(request: NextRequest): string {
  return request.headers.get("user-agent") ?? "unknown";
}

function getCountry(request: NextRequest): string {
  const geoCountry = (request as VercelNextRequest).geo?.country;
  if (geoCountry !== null && geoCountry !== undefined) return geoCountry;

  const vercelHeader = request.headers.get("x-vercel-ip-country");
  if (vercelHeader !== null && geoCountry !== undefined) return vercelHeader.toUpperCase();

  if (!IS_PROD) return "LOCAL";

  return "UNKNOWN";
}

function logTraffic(
  msg: string,
  method: string,
  url: string,
  path: string,
  ip: string,
  country: string,
  userAgent: string,
  requestId: string,
  event: NextFetchEvent
) {
  logger.info({
    msg,
    method,
    url,
    path,
    ip,
    country,
    userAgent,
    requestId,
  });

  event.waitUntil(logger.flush());
}

async function handleRateLimitAndSize(
  request: NextRequest,
  pathname: string,
  ip: string,
  requestId: string
): Promise<NextResponse | null> {
  if (pathname.includes("/uploadthing") || pathname.includes("/webhooks")) {
    return null;
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > ONE_MB) {
    return new NextResponse(JSON.stringify({ error: "Payload Too Large", requestId }), {
      status: 413,
      headers: { "content-type": "application/json" },
    });
  }

  let success = true;
  let limit = 0;
  let reset = 0;
  let remaining = 0;

  if (ratelimit) {
    const token = request.cookies.get(cookieName)?.value;
    let identifier = ip;
    if (token !== null && token !== undefined) identifier = await hashToken(token);

    const result = await ratelimit.limit(identifier);
    success = result.success;
    limit = result.limit;
    reset = result.reset;
    remaining = result.remaining;
  }

  if (!success) {
    return new NextResponse(
      JSON.stringify({
        error: "Too Many Requests",
        message: "You're sending requests too often. Please wait.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  }

  return null;
}

async function handleTurnstile(request: NextRequest, ip: string): Promise<NextResponse | null> {
  const token = request.cookies.get("cf-turnstile-response")?.value;
  const secretKey = TURNSTILE_SECRET_KEY;

  if (token == null || secretKey == null) {
    return new NextResponse(JSON.stringify({ error: "Missing captcha" }), { status: 403 });
  }

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);
  formData.append("remoteip", ip);

  try {
    const cfRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const cfData = await cfRes.json();

    if (cfData.success === false || cfData.action !== "auth") {
      console.error("Cloudflare verification failed:", cfData["error-codes"]);
      return new NextResponse(JSON.stringify({ error: "Captcha failed" }), { status: 403 });
    }
    const response = NextResponse.next();
    response.cookies.delete("cf-turnstile-response");
    return response;
  } catch (error) {
    console.error("Cloudflare network error:", error);
    return new NextResponse(JSON.stringify({ error: "Security check error. Please try again." }), {
      status: 403,
    });
  }
}

async function handleApiRequest(
  request: NextRequest,
  requestId: string,
  ip: string
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const rateLimitResponse = await handleRateLimitAndSize(request, pathname, ip, requestId);
  if (rateLimitResponse) return rateLimitResponse;

  if (pathname === "/api/auth/signin/email" && request.method === "POST") {
    const turnstileResponse = await handleTurnstile(request, ip);
    if (turnstileResponse) return turnstileResponse;
  }

  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return response;
}

function handlePageRequest(request: NextRequest, requestId: string): NextResponse {
  const { pathname } = request.nextUrl;
  const localeRegex = new RegExp(`^/(${LOCALE_REGEX_STR})`);
  const pathWithoutLocale = pathname.replace(localeRegex, "") || "/";

  const isProtectedRoute = protectedRoutes.some((route) => pathWithoutLocale.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathWithoutLocale.startsWith(route));

  const token = request.cookies.get(cookieName)?.value;

  if (isProtectedRoute && token == null) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && token != null) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // const requestHeaders = new Headers(request.headers);
  // requestHeaders.set("x-request-id", requestId);
  // requestHeaders.set("x-url", request.url);

  const response = intlMiddleware(request);

  response.headers.set("x-request-id", requestId);
  response.cookies.set("last_request_id", requestId, {
    path: "/",
    maxAge: 60,
    httpOnly: false,
    sameSite: "lax",
  });

  return response;
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const requestId = crypto.randomUUID();
  const { pathname } = request.nextUrl;
  const ip = getIp(request);
  const userAgent = getUa(request);
  const method = request.method;
  const country = getCountry(request);
  logTraffic(
    "Incoming Traffic",
    method,
    request.url,
    pathname,
    ip,
    country,
    userAgent,
    requestId,
    event
  );

  if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) {
    return handleApiRequest(request, requestId, ip);
  }

  return handlePageRequest(request, requestId);
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
