import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { requireAuth } from "@/core/middleware/auth.middleware";
import { getRequestContext } from "@/utils/request-context";

import { recordAuditLog } from "../audit/audit.service";
import { scanRequestSchema } from "./scan.schema";
import { scanLogContent } from "./scan.service";

export const scanRouter = new Hono()
  .use("*", requireAuth)
  .post("/scan", zValidator("json", scanRequestSchema), async (c) => {
    const { content, fileName } = c.req.valid("json");
    const user = c.get("user");

    const result = await scanLogContent(content, fileName);

    const ctx = getRequestContext(c);

    await recordAuditLog({
      action: "scan.manual",
      actor: user?.email ?? "system",
      ctx,
      target: `file:${fileName}`,
    });

    return c.json(result, 200);
  });
