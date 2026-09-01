import type { PaginatedResponse } from "@doxynix/shared";
import { desc } from "drizzle-orm";

import { db } from "@/core/db/db";
import { executePaginatedQuery } from "@/core/db/pagination";
import { type FindingSelect, type IncidentSelect, incidents } from "@/core/db/schema";
import { combineConditions, eqIf, ilikeIf } from "@/core/db/utils";

import type { GetIncidentsQuery } from "./incidents.schema";

export async function getIncidentsList(
  query: GetIncidentsQuery,
): Promise<PaginatedResponse<IncidentSelect>> {
  const { page, limit, severity, fileName } = query;

  return executePaginatedQuery({
    limit,
    orderBy: [desc(incidents.createdAt), desc(incidents.id)],
    page,
    table: incidents,
    whereClause: combineConditions(
      eqIf(incidents.severity, severity),
      ilikeIf(incidents.fileName, fileName),
    ),
  });
}

type GetIncidentByIdQuery =
  | (IncidentSelect & {
      findings: FindingSelect[];
    })
  | null;

export async function getIncidentById(id: string): Promise<GetIncidentByIdQuery> {
  const incident = await db.query.incidents.findFirst({
    where: (table, { eq }) => eq(table.id, id),
    with: {
      findings: true,
    },
  });

  return incident ?? null;
}
