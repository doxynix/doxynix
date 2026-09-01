import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { requireAuth, requireRole } from "@/core/middleware/auth.middleware";

import { getAuditLogsQuerySchema } from "./audit.schema";
import { getAuditLogsList } from "./audit.service";

export const auditRouter = new Hono()
  .use("*", requireAuth, requireRole("admin"))
  .get("/", zValidator("query", getAuditLogsQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const result = await getAuditLogsList(query);
    return c.json(result, 200);
  });
