import { NextResponse, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { logger } from "./server/shared/infrastructure/logger";
import { redisClient } from "./server/shared/infrastructure/redis";
import { generateRequestId, getIp, sanitizeRequestId } from "./server/shared/lib/request-context";
import { API_PREFIX, IS_PROD } from "./shared/constants/env.client";
import { TURNSTILE_SECRET_KEY } from "./shared/constants/env.server";
import { LOCALE_REGEX_STR } from "./shared/constants/locales";
import { getCookieName } from "./shared/lib/utils";

const protectedRoutes = ["/dashboard"];
const authRoutes = ["/auth"];
const cookieName = getCookieName();
const ANALYTICS_TUNNELS = [`${API_PREFIX}/dxnx/p`, `${API_PREFIX}/dxnx/s`];

let ratelimit: null | Ratelimit = null;
const ephemeralCache = new Map<string, number>();

if (IS_PROD) {
  ratelimit = new Ratelimit({
    analytics: false,
    ephemeralCache: ephemeralCache,
    limiter: Ratelimit.slidingWindow(20, "10 s"),
    prefix: "@upstash/ratelimit",
    redis: redisClient,
  });
}

const intlMiddleware = createMiddleware(routing);

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

async function handleRateLimitAndSize(
  request: NextRequest,
  pathname: string,
  ip: string
): Promise<NextResponse | null> {
  if (hasPathBoundary(pathname, "/api/webhooks") || hasPathBoundary(pathname, "/webhooks")) {
    return null;
  }

  if (ratelimit != null) {
    const token = request.cookies.get(cookieName)?.value;
    const identifier = token != null ? `user_${token.slice(-16)}` : `ip_${ip}`;
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
        }
      );
    }
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
  const attachRequestMeta = (response: NextResponse): NextResponse => {
    response.headers.set("x-request-id", requestId);
    response.cookies.set("last_request_id", requestId, {
      httpOnly: false,
      maxAge: 60,
      path: "/",
      sameSite: "lax",
      secure: IS_PROD,
    });
    return response;
  };

  const rateLimitResponse = await handleRateLimitAndSize(request, pathname, ip);
  if (rateLimitResponse) return attachRequestMeta(rateLimitResponse);

  if (pathname === "/api/auth/signin/email" && request.method === "POST") {
    const turnstileResponse = await handleTurnstile(request, ip);
    if (turnstileResponse) {
      if (turnstileResponse.status !== 200) return attachRequestMeta(turnstileResponse);
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-request-id", requestId);
      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
      for (const cookie of turnstileResponse.cookies.getAll()) {
        response.cookies.set(cookie);
      }
      return attachRequestMeta(response);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  return attachRequestMeta(response);
}

function handlePageRequest(request: NextRequest, requestId: string): NextResponse {
  const { pathname } = request.nextUrl;
  const localeRegex = new RegExp(`^/(${LOCALE_REGEX_STR})`);
  const pathWithoutLocale = pathname.replace(localeRegex, "") || "/";

  const isProtectedRoute = protectedRoutes.some((route) =>
    hasPathBoundary(pathWithoutLocale, route)
  );
  const isAuthRoute = authRoutes.some((route) => hasPathBoundary(pathWithoutLocale, route));

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

export async function proxy(request: NextRequest) {
  const requestId = sanitizeRequestId(request.headers.get("x-request-id")) ?? generateRequestId();
  const { pathname } = request.nextUrl;

  if (isUploadThingPath(pathname)) {
    return NextResponse.next();
  }

  if (isAnalyticsTunnel(pathname)) {
    return NextResponse.next();
  }

  const ip = getIp(request);

  if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) {
    return handleApiRequest(request, requestId, ip);
  }

  return handlePageRequest(request, requestId);
}
export const config = {
  matcher: [
    "/dashboard/repo/:path*",
    "/((?!_next|_vercel|monitoring|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json|woff2?|ttf|otf|webmanifest)$).*)",
  ],
};
