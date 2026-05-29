import dns from "node:dns";
import { NextResponse } from "next/server";
import ipaddr from "ipaddr.js";
import { Agent } from "undici";

import { appLogger } from "@/server/core/app-logger";
import { getServerAuthSession } from "@/server/core/auth";

interface ProxyRequestBody {
  body?: unknown;
  headers?: Record<string, unknown>;
  method?: string;
  url?: string;
}

type DnsLookupCallback = (err: Error | null, address: null | string, family: null | number) => void;

export function isSafeIp(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return false;

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
  callback: DnsLookupCallback
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
        callback(new Error("Forbidden: Unsafe target IP detected"), null, null);
        return;
      }
      callback(null, address, family);
    } catch (validationError) {
      callback(
        validationError instanceof Error ? validationError : new Error(String(validationError)),
        null,
        null
      );
    }
  });
}

export const ssrfSafeAgent = new Agent({
  connect: {
    lookup: ssrfSafeLookup,
  } as any,
});

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const payload = (await req.json()) as ProxyRequestBody;
    const { body, headers, method, url } = payload;

    if (url == null || method == null) {
      return new NextResponse("Missing url or method parameters", { status: 400 });
    }

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return new NextResponse("Forbidden: Unsafe protocol", { status: 403 });
      }
    } catch {
      return new NextResponse("Invalid URL format", { status: 400 });
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

    const response = await fetch(url, {
      body: requestBody,
      headers: filteredHeaders,
      method,
      ...({ dispatcher: ssrfSafeAgent } as any),
    });

    const responseData = await response.text();

    return NextResponse.json({
      body: responseData,
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("Forbidden: Unsafe target IP detected")) {
      return new NextResponse("Forbidden: Unsafe target URL detected", { status: 403 });
    }

    appLogger.error({
      error: errorMessage,
      msg: "Proxy request failed",
    });
    return new NextResponse("Proxy Error", { status: 502 });
  }
}
