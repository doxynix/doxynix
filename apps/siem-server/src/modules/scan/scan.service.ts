import type { ScanResult } from "@doxynix/shared";
import { eq } from "drizzle-orm";

import { db } from "@/core/db/db";
import { cronSyncState, findings, incidents, rules } from "@/core/db/schema";

import { analyzeLogContent } from "./scan.engine";

export type CheckpointState = {
  serviceName: string;
  serializedPosition: string;
};

export async function scanLogContent(
  content: string,
  fileName: string,
  checkpointState?: CheckpointState,
): Promise<ScanResult> {
  const activeRules = await db
    .select({
      id: rules.id,
      name: rules.name,
      pattern: rules.pattern,
      severity: rules.severity,
    })
    .from(rules)
    .where(eq(rules.isActive, true));

  const engineResult = analyzeLogContent(content, activeRules);

  if (!engineResult.isSafe || checkpointState != null) {
    await db.transaction(async (tx) => {
      if (!engineResult.isSafe) {
        const [insertedIncident] = await tx
          .insert(incidents)
          .values({
            fileName,
            findingsCount: engineResult.findings.length,
            score: engineResult.score,
            severity: engineResult.maxSeverity,
          })
          .returning();

        if (insertedIncident == null) {
          throw new Error("Failed to persist security incident record");
        }

        await tx.insert(findings).values(
          engineResult.findings.map((f) => ({
            incidentId: insertedIncident.id,
            line: f.line,
            matchedText: f.matchedText,
            ruleName: f.ruleName,
            severity: f.severity,
          })),
        );
      }

      if (checkpointState != null) {
        await tx
          .insert(cronSyncState)
          .values({
            lastSyncedPosition: checkpointState.serializedPosition,
            serviceName: checkpointState.serviceName,
          })
          .onConflictDoUpdate({
            set: {
              lastSyncedPosition: checkpointState.serializedPosition,
              updatedAt: new Date(),
            },
            target: cronSyncState.serviceName,
          });
      }
    });
  }

  return {
    findings: engineResult.findings,
    isSafe: engineResult.isSafe,
    message: engineResult.isSafe
      ? "Log content is safe. No sensitive data leaked."
      : `Security threat detected! Found ${engineResult.findings.length} leak(s).`,
  };
}
