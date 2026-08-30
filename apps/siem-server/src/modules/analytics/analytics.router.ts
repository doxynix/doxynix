import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "@server/core/middleware/auth.middleware";
import { Hono } from "hono";
import { dashboardAnalyticsQuerySchema } from "./analytics.schema";
import { getDashboardAnalytics } from "./analytics.service";

export const analyticsRouter = new Hono()
  .use("*", requireAuth)
  .get("/dashboard", zValidator("query", dashboardAnalyticsQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const analytics = await getDashboardAnalytics(query);
    return c.json(analytics, 200);
  });
