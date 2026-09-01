import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { requireAuth, requireRole } from "@/core/middleware/auth.middleware";
import { getRequestContext } from "@/utils/request-context";

import { recordAuditLog } from "@/modules/audit/audit.service";

import {
  createRuleSchema,
  getRulesQuerySchema,
  ruleParamsSchema,
  updateRuleSchema,
} from "./rules.schema";
import { createRule, deleteRule, getRulesList, updateRule } from "./rules.service";

const UPDATE_ERROR_MAP = {
  conflict: { error: "A rule with this name already exists", status: 409 },
  not_found: { error: "Rule not found", status: 404 },
} as const;

export const rulesRouter = new Hono()
  .use("*", requireAuth)
  .get("/", zValidator("query", getRulesQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const result = await getRulesList(query);
    return c.json(result, 200);
  })
  .post("/", requireRole("admin"), zValidator("json", createRuleSchema), async (c) => {
    const data = c.req.valid("json");
    const user = c.get("user");
    const rule = await createRule(data);

    if (rule == null) {
      return c.json({ error: "A rule with this name already exists", success: false }, 409);
    }

    const ctx = getRequestContext(c);

    await recordAuditLog({
      action: "rule.create",
      actor: user?.email ?? "system",
      ctx,
      target: `rule:${rule.name}`,
    });

    return c.json(rule, 201);
  })
  .patch(
    "/:id",
    requireRole("admin"),
    zValidator("param", ruleParamsSchema),
    zValidator("json", updateRuleSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const data = c.req.valid("json");
      const user = c.get("user");
      const result = await updateRule(id, data);

      if (!result.success) {
        const mappedError = UPDATE_ERROR_MAP[result.reason];
        return c.json({ error: mappedError.error, success: false }, mappedError.status);
      }

      const ctx = getRequestContext(c);

      await recordAuditLog({
        action: "rule.update",
        actor: user?.email ?? "system",
        ctx,
        target: `rule_id:${id}`,
      });

      return c.json(result.data, 200);
    },
  )
  .delete("/:id", requireRole("admin"), zValidator("param", ruleParamsSchema), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user");
    const success = await deleteRule(id);

    if (!success) {
      return c.json({ error: "Rule not found", success: false }, 404);
    }

    const ctx = getRequestContext(c);

    await recordAuditLog({
      action: "rule.delete",
      actor: user?.email ?? "system",
      ctx,
      target: `rule_id:${id}`,
    });

    return c.json({ message: "Rule deleted successfully", success: true }, 200);
  });
