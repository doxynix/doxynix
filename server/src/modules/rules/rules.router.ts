import { zValidator } from "@hono/zod-validator";
import { type AuthEnv, requireAuth, requireRole } from "@server/core/middleware/auth.middleware";
import { recordAuditLog } from "@server/modules/audit/audit.service";
import { getRequestContext } from "@server/utils/request-context";
import { Hono } from "hono";
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

export const rulesRouter = new Hono<AuthEnv>()
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
      return c.json({ success: false, error: "A rule with this name already exists" }, 409);
    }

    const ctx = getRequestContext(c);

    await recordAuditLog({
      actor: user.email,
      action: "rule.create",
      target: `rule:${rule.name}`,
      ctx,
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
        return c.json({ success: false, error: mappedError.error }, mappedError.status);
      }

      const ctx = getRequestContext(c);

      await recordAuditLog({
        actor: user.email,
        action: "rule.update",
        target: `rule_id:${id}`,
        ctx,
      });

      return c.json(result.data, 200);
    },
  )
  .delete("/:id", requireRole("admin"), zValidator("param", ruleParamsSchema), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user");
    const success = await deleteRule(id);

    if (!success) {
      return c.json({ success: false, error: "Rule not found" }, 404);
    }

    const ctx = getRequestContext(c);

    await recordAuditLog({
      actor: user.email,
      action: "rule.delete",
      target: `rule_id:${id}`,
      ctx,
    });

    return c.json({ success: true, message: "Rule deleted successfully" }, 200);
  });
