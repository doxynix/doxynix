import { type NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import createMiddleware from "next-intl/middleware";

import { IS_PROD, IS_RATE_LIMIT_ENABLED } from "@/shared/config/env.flags";

import { appLogger } from "./server/core/app-logger";
import { redisClient } from "./server/core/redis";
import { REDIS_CONFIG } from "./server/utils/redis";
import { generateRequestId, getIp, sanitizeRequestId } from "./server/utils/request-context";
import { routing } from "./shared/i18n/routing";
import { getCookieName } from "./shared/lib/cookies";
import { isBypassRoute, resolveDocsPath, resolvePageRedirect } from "./shared/lib/proxy-routing";

const cookieName = getCookieName();

let ratelimit: null | Ratelimit = null;
const ephemeralCache = new Map<string, number>();

if (IS_PROD && IS_RATE_LIMIT_ENABLED) {
  ratelimit = new Ratelimit({
    analytics: false,
    enableProtection: true,
    ephemeralCache: ephemeralCache,
    limiter: Ratelimit.slidingWindow(20, "10 s"),
    prefix: "@doxynix/ratelimit/global",
    redis: redisClient,
    timeout: 800,
  });
}

const intlMiddleware = createMiddleware(routing);

async function handleRateLimitAndSize(
  request: NextRequest,
  pathname: string,
  ip: string,
): Promise<NextResponse | null> {
  if (isBypassRoute(pathname)) {
    return null;
  }

  if (ratelimit != null) {
    const token = request.cookies.get(cookieName)?.value;
    const identifier =
      token != null ? REDIS_CONFIG.rateLimit.userToken(token) : REDIS_CONFIG.rateLimit.ip(ip);

    try {
      const { limit, remaining, reset, success } = await ratelimit.limit(identifier);

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
          },
        );
      }
    } catch (error) {
      appLogger.error({ error, msg: "Global rate limiter experienced an error. Bypassing." });
    }
  }

  return null;
}

function attachRequestMeta(response: NextResponse, requestId: string): NextResponse {
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

async function handleApiRequest(
  request: NextRequest,
  requestId: string,
  ip: string,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const rateLimitResponse = await handleRateLimitAndSize(request, pathname, ip);
  if (rateLimitResponse) {
    return attachRequestMeta(rateLimitResponse, requestId);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  return attachRequestMeta(response, requestId);
}

function handlePageRequest(request: NextRequest, requestId: string): NextResponse {
  const { pathname } = request.nextUrl;

  const docsDecision = resolveDocsPath(pathname);

  if (docsDecision != null) {
    const url = request.nextUrl.clone();
    url.pathname = docsDecision.pathname;

    const response =
      docsDecision.type === "redirect"
        ? NextResponse.redirect(url, 308)
        : NextResponse.rewrite(url);

    return attachRequestMeta(response, requestId);
  }

  const token = request.cookies.get(cookieName)?.value;
  const redirectPath = resolvePageRedirect(pathname, token != null);

  if (redirectPath != null) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    return NextResponse.redirect(url);
  }

  const response = intlMiddleware(request);

  return attachRequestMeta(response, requestId);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isBypassRoute(pathname)) {
    return NextResponse.next();
  }

  const requestId = sanitizeRequestId(request.headers.get("x-request-id")) ?? generateRequestId();
  const ip = getIp(request);

  if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) {
    return handleApiRequest(request, requestId, ip);
  }

  return handlePageRequest(request, requestId);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_vercel|monitoring|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|icons/.*|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json|woff2?|ttf|otf|webmanifest)$).*)",
  ],
};
