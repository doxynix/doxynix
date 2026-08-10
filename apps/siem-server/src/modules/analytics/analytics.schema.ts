import { z } from "zod";

export const dashboardAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).optional().default(7),
});

export type DashboardAnalyticsQuery = z.infer<typeof dashboardAnalyticsQuerySchema>;
