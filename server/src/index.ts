import type { LeakFinding, ScanResult } from "@doxynix/siem-shared";
import { axiom } from "@server/axiom";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { contextStorage } from "hono/context-storage";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { auth } from "./auth";

export const app = new Hono()
  .basePath("/api")
  .use("*", contextStorage())
  .use("*", logger())
  .use("*", secureHeaders())
  .use("*", compress())
  .use("*", csrf({ origin: ["http://localhost:3000", "https://localhost:3000"] }))
  .use(
    "*",
    cors({
      origin: ["http://localhost:3000", "https://localhost:3000"],
      credentials: true,
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  )
  .use(
    "/upload/*",
    bodyLimit({
      maxSize: 4 * 1024 * 1024,
      onError: (c) => c.text("File too large!", 413),
    }),
  )
  .get("/ping", (c) => {
    return c.json({
      status: "ok",
      message: "pong",
    });
  })
  .on(["POST", "GET"], "/auth/*", (c) => {
    return auth.handler(c.req.raw);
  })
  .post("/logs/scan", async (c) => {
    const findings: LeakFinding[] = [];
    const cardRegex = /\b(?:\d[ -]*?){13,16}\b/g;

    const res = await axiom.query("['web-production'] | order by _time desc | limit 100");

    if (!res?.matches) {
      return c.json<ScanResult>({ isSafe: true, message: "logs not found" });
    }

    for (const entry of res.matches) {
      const logText = entry.data.fields?.msg || "";
      const isCardCredentials = cardRegex.test(logText);
      if (isCardCredentials) {
        findings.push({
          ruleId: "credit-card",
          ruleName: "Credit Card Leak",
          severity: "critical",
          matchedText: "Card detected and masked",
        });
      }
    }

    if (findings.length === 0) {
      return c.json<ScanResult>({
        isSafe: true,
        message: "All logs clean! Keep it up!",
      });
    } else {
      return c.json<ScanResult>({
        isSafe: false,
        message: "Find issues please remove sensitive data!",
        findings,
      });
    }
  });

export type AppType = typeof app;

export default {
  port: 8080,
  fetch: app.fetch,
};
