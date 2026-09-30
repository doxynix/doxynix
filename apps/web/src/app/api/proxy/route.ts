import dns from "node:dns";

import { headers as getRequestHeaders } from "next/headers";
import { NextResponse } from "next/server";
import ipaddr from "ipaddr.js";
import { Agent } from "undici";

import { appLogger } from "@/server/core/app-logger";
import { auth } from "@/server/core/auth";
import { AppError, findAppError } from "@/server/utils/api-error";
import { withApiHandler } from "@/server/utils/with-api-handler";

import { ProxyRequestBody } from "./proxy-request.schema";

type DnsLookupCallback = (err: Error | null, address: null | string, family: null | number) => void;

const UNSAFE_TARGET_MESSAGE = "Forbidden: Unsafe target IP detected";

export function isSafeIp(ip: string): boolean {
  if (!ipaddr.isValid(ip)) {
    return false;
  }

  const addr = ipaddr.process(ip);
  const range = addr.range();

  const unsafeRanges = [
    "uniqueLocal",
    "loopback",
    "private",
    "linkLocal",
    "carrierGradeNat",
    "unspecified",
    "broadcast",
  ];

  return !unsafeRanges.includes(range);
}

export function ssrfSafeLookup(
  hostname: string,
  options: dns.LookupOneOptions,
  callback: DnsLookupCallback,
): void {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) {
      callback(err, null, null);
      return;
    }

    try {
      if (address && !isSafeIp(address)) {
        appLogger.warn({
          address,
          hostname,
          msg: "SSRF prevention triggered during socket lookup",
          range: ipaddr.process(address).range(),
        });
        callback(
          new AppError({ code: "FORBIDDEN", publicMessage: UNSAFE_TARGET_MESSAGE }),
          null,
          null,
        );
        return;
      }
      callback(null, address, family);
    } catch (validationError) {
      callback(
        validationError instanceof Error ? validationError : new Error(String(validationError)),
        null,
        null,
      );
    }
  });
}

type ProxiedRequestInit = RequestInit & { dispatcher?: Agent };

export const ssrfSafeAgent = new Agent({
  connect: {
    lookup: ssrfSafeLookup,
  } as never,
});

async function handler(req: Request) {
  const session = await auth.api.getSession({
    headers: await getRequestHeaders(),
  });

  if (!session?.user) {
    throw new AppError({ code: "UNAUTHORIZED", publicMessage: "Unauthorized" });
  }

  const parsed = ProxyRequestBody.safeParse(await req.json());

  if (!parsed.success) {
    throw new AppError({ code: "BAD_REQUEST", publicMessage: "Invalid request body" });
  }

  const { body, headers, method, url } = parsed.data;

  if (url == null || method == null) {
    throw new AppError({
      code: "BAD_REQUEST",
      publicMessage: "Missing url or method parameters",
    });
  }

  let validatedUrl: string;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new AppError({ code: "FORBIDDEN", publicMessage: "Forbidden: Unsafe protocol" });
    }
    validatedUrl = parsedUrl.toString();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError({ code: "BAD_REQUEST", publicMessage: "Invalid URL format" });
  }

  const filteredHeaders: Record<string, string> = {};
  if (headers && typeof headers === "object") {
    const forbiddenHeaders = new Set(["connection", "cookie", "host"]);
    for (const [key, value] of Object.entries(headers)) {
      if (!forbiddenHeaders.has(key.toLowerCase())) {
        filteredHeaders[key] = String(value);
      }
    }
  }

  const requestBody =
    method !== "GET" && method !== "HEAD" && body != null
      ? typeof body === "string"
        ? body
        : JSON.stringify(body)
      : undefined;

  const proxiedInit: ProxiedRequestInit = {
    body: requestBody,
    dispatcher: ssrfSafeAgent,
    headers: filteredHeaders,
    method,
  };

  let response: Response;

  try {
    response = await fetch(validatedUrl, proxiedInit);
  } catch (error) {
    const ssrf = findAppError(error);

    if (ssrf != null) {
      throw ssrf;
    }

    throw new AppError({
      cause: error,
      code: "BAD_GATEWAY",
      publicMessage: "Proxy Error",
      unexpected: true,
    });
  }

  const responseData = await response.text();

  return NextResponse.json({
    body: responseData,
    headers: Object.fromEntries(response.headers.entries()),
    status: response.status,
  });
}

export const POST = withApiHandler(handler, { scope: "proxy" });
