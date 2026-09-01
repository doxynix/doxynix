import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { requireAuth } from "@/core/middleware/auth.middleware";

import { getIncidentsQuerySchema, incidentParamsSchema } from "./incidents.schema";
import { getIncidentById, getIncidentsList } from "./incidents.service";

export const incidentsRouter = new Hono()
  .use("*", requireAuth)
  .get("/", zValidator("query", getIncidentsQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const result = await getIncidentsList(query);
    return c.json(result, 200);
  })
  .get("/:id", zValidator("param", incidentParamsSchema), async (c) => {
    const { id } = c.req.valid("param");
    const incident = await getIncidentById(id);

    if (incident == null) {
      return c.json({ error: "Incident not found", success: false }, 404);
    }

    return c.json(incident, 200);
  });
