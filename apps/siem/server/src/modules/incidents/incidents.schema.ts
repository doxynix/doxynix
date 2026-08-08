import { paginationQuerySchema } from "@server/core/db/pagination";
import { selectIncidentSchema } from "@server/core/db/schema";
import { z } from "zod";

export const getIncidentsQuerySchema = paginationQuerySchema.extend({
  severity: selectIncidentSchema.shape.severity.optional(),
  fileName: selectIncidentSchema.shape.fileName.optional(),
});

export const incidentParamsSchema = z.object({
  id: z.uuid("Invalid incident ID format"),
});

export type GetIncidentsQuery = z.infer<typeof getIncidentsQuerySchema>;
export type IncidentParams = z.infer<typeof incidentParamsSchema>;
