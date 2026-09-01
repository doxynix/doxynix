import { z } from "zod";

import { paginationQuerySchema } from "@/core/db/pagination";
import { selectIncidentSchema } from "@/core/db/schema";

export const getIncidentsQuerySchema = paginationQuerySchema.extend({
  fileName: selectIncidentSchema.shape.fileName.optional(),
  severity: selectIncidentSchema.shape.severity.optional(),
});

export const incidentParamsSchema = z.object({
  id: z.uuid("Invalid incident ID format"),
});

export type GetIncidentsQuery = z.infer<typeof getIncidentsQuerySchema>;
export type IncidentParams = z.infer<typeof incidentParamsSchema>;
