import type { AuditLog } from "@prisma/client";
import safeStringify from "fast-safe-stringify";
import { UAParser } from "ua-parser-js";

import { formatUserAgent } from "@/server/shared/lib/ua-parser";

import type { AuditLogType, AuditSeverityType } from "./audit-log.schema";

const MODEL_CONFIG: Record<string, { icon: string; name: string }> = {
  Account: { icon: "ghost", name: "Connected Account" },
  Analysis: { icon: "analysis", name: "Analysis" },
  ApiKey: { icon: "key", name: "API Key" },
  GeneratedFix: { icon: "shield", name: "AI Fix" },
  GithubInstallation: { icon: "github", name: "GitHub App" },
  Notification: { icon: "database", name: "Notification" },
  PullRequestAnalysis: { icon: "git-pr", name: "PR Analysis" },
  Repo: { icon: "github", name: "Repository" },
  User: { icon: "user", name: "Profile" },
};

type AuditPayload = {
  data?: Record<string, unknown>;
  where?: Record<string, unknown>;
};

const SKIP_FIELDS = new Set([
  "analysisId",
  "githubId",
  "id",
  "include",
  "jobId",
  "nodeId",
  "prAnalysisId",
  "repoId",
  "select",
  "userId",
]);

function auditReplacer(key: string, value: unknown): unknown {
  if (SKIP_FIELDS.has(key)) return undefined;

  if (typeof value === "bigint") return value.toString();

  return value;
}

const OP_MAP: Record<string, { severity: AuditSeverityType; title: string }> = {
  create: { severity: "success", title: "Created" },
  delete: { severity: "error", title: "Deleted" },
  deleteMany: { severity: "error", title: "Bulk Deleted" },
  update: { severity: "info", title: "Updated" },
  upsert: { severity: "info", title: "Modified" },
};

export function sanitizeObject(obj: unknown): Record<string, unknown> {
  if (obj == null || typeof obj !== "object") return {};

  try {
    const sanitized = JSON.parse(safeStringify(obj, auditReplacer));

    return sanitized != null && typeof sanitized === "object"
      ? (sanitized as Record<string, unknown>)
      : {};
  } catch {
    return { _error: "Sanitization failed" };
  }
}

const getStr = (val: unknown): string | undefined => (typeof val === "string" ? val : undefined);

export function mapAuditLogToDTO(log: AuditLog): AuditLogType {
  const rawPayload = log.payload as unknown as AuditPayload;
  const data = rawPayload.data ?? {};
  const where = rawPayload.where ?? {};

  const browserDisplay = formatUserAgent(log.userAgent);
  const sanitizedPayload = sanitizeObject(rawPayload);

  const parser = new UAParser(log.userAgent ?? "");
  const device = parser.getDevice();

  let deviceType: AuditLogType["deviceType"] = "desktop";
  if (log.userAgent === "internal") deviceType = "system";
  else if (device.type === "mobile") deviceType = "mobile";
  else if (device.type === "tablet") deviceType = "tablet";

  const config = MODEL_CONFIG[log.model] || { icon: "database", name: log.model };
  const op = OP_MAP[log.operation] || { severity: "info", title: log.operation };

  let targetName;
  switch (log.model) {
    case "Repo": {
      targetName = getStr(data.fullName) ?? getStr(data.name) ?? getStr(where.name) ?? "Repository";
      break;
    }
    case "ApiKey": {
      targetName = getStr(data.name) ?? getStr(where.name) ?? "API Key";
      break;
    }
    case "User": {
      targetName = getStr(data.name) ?? "Personal Profile";
      break;
    }
    case "GithubInstallation": {
      targetName = getStr(data.accountLogin) ?? "GitHub Installation";
      break;
    }
    case "Analysis": {
      targetName = `Analysis Task`;
      break;
    }
    case "Account": {
      targetName = `${getStr(data.provider) ?? "Social"} login`;
      break;
    }
    default: {
      const fallbackId =
        typeof where.id === "string" ? where.id.slice(0, 8) : String(where.id ?? "");
      targetName = getStr(data.name) ?? getStr(data.label) ?? (fallbackId || "System Entity");
    }
  }

  const details: { label: string; value: string }[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (!SKIP_FIELDS.has(key) && value != null && typeof value !== "object") {
      details.push({
        label: key.replaceAll(/([A-Z])/g, " $1").toLowerCase(),
        value: String(value),
      });
    }
  });

  return {
    actionTitle: op.title,
    browser: browserDisplay,
    createdAt: log.createdAt,
    details: details.length > 0 ? details : null,
    deviceType,
    entityType: config.name,
    iconKey: config.icon,
    id: log.id,
    ip: log.ip,
    rawPayload: sanitizedPayload,
    requestId: log.requestId,
    severity: op.severity,
    targetName: String(targetName),
  };
}
