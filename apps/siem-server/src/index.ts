import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { contextStorage } from "hono/context-storage";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";

import { auth } from "./core/auth/auth";
import { startAxiomIngestionWorker } from "./core/axiom/axiom-ingestion-worker";
import { env } from "./core/env";
import { createRateLimiter } from "./core/ratelimit";
import { adminRouter } from "./modules/admin/admin.router";
import { analyticsRouter } from "./modules/analytics/analytics.router";
import { auditRouter } from "./modules/audit/audit.router";
import { incidentsRouter } from "./modules/incidents/incidents.router";
import { rulesRouter } from "./modules/rules/rules.router";
import { initScanEventListener } from "./modules/scan/scan.listener";
import { scanRouter } from "./modules/scan/scan.router";
import { streamLogsRouter } from "./modules/stream-logs/stream-logs.router";

export const app = new Hono()
  .basePath("/api")
  .use("*", contextStorage())
  .use("*", logger())
  .use(
    "*",
    cors({
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
      origin: (origin) => origin || "*",
    }),
  )
  .use("*", csrf({ origin: env.CLIENT_URL }))
  .use("*", secureHeaders())
  .use("*", async (c, next) => {
    if (c.req.path.includes("/stream")) {
      return next();
    }
    return compress()(c, next);
  })
  .use("*", requestId())
  .use("*", timing())
  .use("*", prettyJSON())
  .use(
    "/upload/*",
    bodyLimit({
      maxSize: 4 * 1024 * 1024,
      onError: (c) => c.text("File too large!", 413),
    }),
  )
  .use("*", createRateLimiter({ maxRequests: 100, windowSec: 60 }))
  .get("/ping", (c) => {
    return c.json({
      message: "pong",
      status: "ok",
    });
  })
  .on(["POST", "GET"], "/auth/*", (c) => {
    return auth.handler(c.req.raw);
  })
  .route("/incidents", incidentsRouter)
  .route("/rules", rulesRouter)
  .route("/analytics", analyticsRouter)
  .route("/audit-logs", auditRouter)
  .route("/logs", scanRouter)
  .route("/logs-stream", streamLogsRouter)
  .route("/admin", adminRouter)
  .notFound((c) => {
    return c.json({ error: "Route not found", success: false }, 404);
  })
  .onError((err, c) => {
    return c.json(
      {
        error: env.NODE_ENV === "production" ? "Internal server error" : err.message,
        success: false,
      },
      500,
    );
  });

initScanEventListener();

void startAxiomIngestionWorker();

export type AppType = typeof app;

export default {
  fetch: app.fetch,
  idleTimeout: 255,
  port: 8080,
};
