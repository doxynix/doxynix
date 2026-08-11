import { startAxiomIngestionWorker } from "@server/core/axiom/axiom-ingestion-worker";
import { env } from "@server/core/env";
import { createRateLimiter } from "@server/core/ratelimit";
import { adminRouter } from "@server/modules/admin/admin.router";
import { analyticsRouter } from "@server/modules/analytics/analytics.router";
import { auditRouter } from "@server/modules/audit/audit.router";
import { incidentsRouter } from "@server/modules/incidents/incidents.router";
import { rulesRouter } from "@server/modules/rules/rules.router";
import { initScanEventListener } from "@server/modules/scan/scan.listener";
import { scanRouter } from "@server/modules/scan/scan.router";
import { streamLogsRouter } from "@server/modules/stream-logs/stream-logs.router";
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

export const app = new Hono()
  .basePath("/api")
  .use("*", contextStorage())
  .use("*", logger())
  .use(
    "*",
    cors({
      origin: (origin) => origin || "*",
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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
  .use("*", createRateLimiter({ windowSec: 60, maxRequests: 100 }))
  .get("/ping", (c) => {
    return c.json({
      status: "ok",
      message: "pong",
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
    return c.json({ success: false, error: "Route not found" }, 404);
  })
  .onError((err, c) => {
    return c.json(
      {
        success: false,
        error: env.NODE_ENV === "production" ? "Internal server error" : err.message,
      },
      500,
    );
  });

initScanEventListener();

startAxiomIngestionWorker().catch((error) => {
  console.error("Failed to start Axiom Worker:", error);
});

export type AppType = typeof app;

export default {
  port: 8080,
  idleTimeout: 255,
  fetch: app.fetch,
};
