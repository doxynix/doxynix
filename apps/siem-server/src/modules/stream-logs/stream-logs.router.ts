import { Hono } from "hono";

import { requireAuth } from "@/core/middleware/auth.middleware";

import { handleLogStream } from "@/modules/stream-logs/stream-logs.service";

export const streamLogsRouter = new Hono().use("*", requireAuth).get("/", handleLogStream);
