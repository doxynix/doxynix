import { env } from "@server/core/env";
import { createRateLimiter } from "@server/core/ratelimit";
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
import { auth } from "./core/auth";

export const app = new Hono()
  .basePath("/api")
  .use("*", contextStorage())
  .use("*", logger())
  .use("*", secureHeaders())
  .use("*", compress())
  .use("*", csrf({ origin: env.CLIENT_URL }))
  .use(
    "*",
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  )
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

export type AppType = typeof app;

export default {
  port: 8080,
  fetch: app.fetch,
};
