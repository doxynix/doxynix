import { requireAuth } from "@server/core/middleware/auth.middleware";
import { handleLogStream } from "@server/modules/stream-logs/stream-logs.service";
import { Hono } from "hono";

export const streamLogsRouter = new Hono().use("*", requireAuth).get("/", handleLogStream);
