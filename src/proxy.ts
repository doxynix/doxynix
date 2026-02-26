import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { redisClient } from "./server/lib/redis";
import { logger } from "./server/logger/logger";
import { API_PREFIX, IS_PROD } from "./shared/constants/env.client";
import { TURNSTILE_SECRET_KEY } from "./shared/constants/env.server";
import { LOCALE_REGEX_STR } from "./shared/constants/locales";
import { getCookieName } from "./shared/lib/utils";

const ONE_MB = 1024 * 1024;
const protectedRoutes = ["/dashboard"];
const authRoutes = ["/auth"];
const cookieName = getCookieName();
const ANALYTICS_TUNNELS = [`${API_PREFIX}/dxnx/p`, `${API_PREFIX}/dxnx/s`];

let ratelimit: Ratelimit | null = null;
if (IS_PROD) {
  ratelimit = new Ratelimit({
    analytics: false,
    limiter: Ratelimit.slidingWindow(20, "10 s"),
    prefix: "@upstash/ratelimit",
    redis: redisClient,
  });
}

const intlMiddleware = createMiddleware(routing);

type VercelNextRequest = NextRequest & {
  geo?: {
    city?: string;
    country?: string;
    region?: string;
  };
  ip?: string;
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
  if (geoCountry != null) return geoCountry;

  const vercelHeader = request.headers.get("x-vercel-ip-country");
  if (vercelHeader != null) return vercelHeader.toUpperCase();

  if (!IS_PROD) return "LOCAL";

  return "UNKNOWN";
}

function hasPathBoundary(pathname: string, prefix: string): boolean {
  if (!pathname.startsWith(prefix)) return false;
  const nextChar = pathname.charAt(prefix.length);
  return nextChar === "" || nextChar === "/";
}

function isAnalyticsTunnel(pathname: string): boolean {
  return ANALYTICS_TUNNELS.some((prefix) => hasPathBoundary(pathname, prefix));
}

function isUploadThingPath(pathname: string): boolean {
  return hasPathBoundary(pathname, "/api/uploadthing");
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
    country,
    ip,
    method,
    msg,
    path,
    requestId,
    url,
    userAgent,
  });

  event.waitUntil(logger.flush());
}

function getPayloadTooLargeResponse(requestId: string): NextResponse {
  return new NextResponse(JSON.stringify({ error: "Payload Too Large", requestId }), {
    headers: { "content-type": "application/json" },
    status: 413,
  });
}

function validateRequestSize(request: NextRequest, requestId: string): NextResponse | null {
  const header = request.headers.get("content-length");
  if (header != null) {
    const contentLength = Number.parseInt(header, 10);
    if (!Number.isFinite(contentLength) || contentLength > ONE_MB) {
      return getPayloadTooLargeResponse(requestId);
    }
  }
  return null;
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

  const payloadTooLargeResponse = validateRequestSize(request, requestId);
  if (payloadTooLargeResponse != null) return payloadTooLargeResponse;

  let success = true;
  let limit = 0;
  let reset = 0;
  let remaining = 0;

  if (ratelimit) {
    const token = request.cookies.get(cookieName)?.value;
    let identifier = ip;
    if (token != null) identifier = await hashToken(token);

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
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
        status: 429,
      }
    );
  }

  return null;
}

async function handleTurnstile(request: NextRequest, ip: string): Promise<NextResponse | null> {
  const token = request.cookies.get("cf-turnstile-response")?.value;
  const secretKey = TURNSTILE_SECRET_KEY;

  if (token == null) {
    return new NextResponse(JSON.stringify({ error: "Missing captcha" }), { status: 403 });
  }

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);
  formData.append("remoteip", ip);

  try {
    const cfRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      body: formData,
      method: "POST",
    });

    const cfData = await cfRes.json();

    if (cfData.success === false || cfData.action !== "auth") {
      logger.error({ error: cfData["error-codes"], msg: "Cloudflare verification failed:" });
      return new NextResponse(JSON.stringify({ error: "Captcha failed" }), { status: 403 });
    }
    const response = NextResponse.next();
    response.cookies.delete("cf-turnstile-response");
    return response;
  } catch (error) {
    logger.error({ error, msg: "Cloudflare network error:" });
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
    httpOnly: false,
    maxAge: 60,
    path: "/",
    sameSite: "lax",
    secure: IS_PROD,
  });

  return response;
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const requestId = crypto.randomUUID();
  const { pathname } = request.nextUrl;

  if (isUploadThingPath(pathname)) {
    return NextResponse.next();
  }

  if (isAnalyticsTunnel(pathname)) {
    const payloadTooLargeResponse = validateRequestSize(request, requestId);
    if (payloadTooLargeResponse != null) {
      logger.error({
        msg: "Analytics tunnel payload too large",
        path: pathname,
        requestId,
        url: request.url,
      });
      event.waitUntil(logger.flush());
      return payloadTooLargeResponse;
    }

    return NextResponse.next();
  }

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
  matcher: [
    "/dashboard/repo/:path*",
    "/((?!_next|_vercel|monitoring|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json|woff2?|ttf|otf)$).*)",
  ],
};
