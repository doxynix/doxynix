import { zValidator } from "@hono/zod-validator";
import { type AuthEnv, requireAuth } from "@server/core/middleware/auth.middleware";
import { Hono } from "hono";
import { getIncidentsQuerySchema, incidentParamsSchema } from "./incidents.schema";
import { getIncidentById, getIncidentsList } from "./incidents.service";

export const incidentsRouter = new Hono<AuthEnv>()
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
      return c.json({ success: false, error: "Incident not found" }, 404);
    }

    return c.json(incident, 200);
  });
