import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "@server/core/middleware/auth.middleware";
import { recordAuditLog } from "@server/modules/audit/audit.service";
import { getRequestContext } from "@server/utils/request-context";
import { Hono } from "hono";
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
      actor: user.email,
      action: "scan.manual",
      target: `file:${fileName}`,
      ctx,
    });

    return c.json(result, 200);
  });
