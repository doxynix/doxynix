import type { PaginatedResponse } from "@doxynix/siem-shared";
import { db } from "@server/core/db/db";
import { executePaginatedQuery } from "@server/core/db/pagination";
import { type FindingSelect, type IncidentSelect, incidents } from "@server/core/db/schema";
import { combineConditions, eqIf, ilikeIf } from "@server/core/db/utils";
import { desc } from "drizzle-orm";
import type { GetIncidentsQuery } from "./incidents.schema";

export async function getIncidentsList(
  query: GetIncidentsQuery,
): Promise<PaginatedResponse<IncidentSelect>> {
  const { page, limit, severity, fileName } = query;

  return executePaginatedQuery({
    table: incidents,
    whereClause: combineConditions(
      eqIf(incidents.severity, severity),
      ilikeIf(incidents.fileName, fileName),
    ),
    orderBy: [desc(incidents.createdAt), desc(incidents.id)],
    page,
    limit,
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
