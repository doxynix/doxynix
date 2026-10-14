import type { AuditModel, AuditOperation } from "@doxynix/shared";
import type { AuditLog } from "@prisma/client";
import { UAParser } from "ua-parser-js";
import * as z from "zod";

import { SKIP_FIELDS, sanitizeObject } from "@/server/utils/sanitize-payload";
import { formatUserAgent } from "@/server/utils/ua-parser";

import type { AuditLogType, AuditSeverityType } from "./audit-logs.schemas";

const MODEL_CONFIG = {
  Account: { icon: "ghost", name: "Connected Account" },
  Analysis: { icon: "analysis", name: "Analysis" },
  ApiKey: { icon: "key", name: "API Key" },
  GeneratedFix: { icon: "shield", name: "AI Fix" },
  GithubInstallation: { icon: "github", name: "GitHub App" },
  Notification: { icon: "database", name: "Notification" },
  PullRequestAnalysis: { icon: "git-pr", name: "PR Analysis" },
  Repo: { icon: "github", name: "Repository" },
  User: { icon: "user", name: "Profile" },
} satisfies Partial<Record<AuditModel, { icon: string; name: string }>>;

type AuditPayload = {
  data?: Record<string, unknown>;
  where?: Record<string, unknown>;
};

const AuditPayloadSchema = z
  .looseObject({
    data: z.record(z.string(), z.unknown()).optional(),
    where: z.record(z.string(), z.unknown()).optional(),
  })
  .partial();

const OP_MAP = {
  CREATE: { severity: "success", title: "Created" },
  DELETE: { severity: "error", title: "Deleted" },
  DELETE_MANY: { severity: "error", title: "Bulk Deleted" },
  UPDATE: { severity: "info", title: "Updated" },
  UPSERT: { severity: "info", title: "Modified" },
} satisfies Partial<Record<AuditOperation, { severity: AuditSeverityType; title: string }>>;

const getStr = (val: unknown): string | undefined => (typeof val === "string" ? val : undefined);

const MODEL_LOOKUP: Record<string, { icon: string; name: string }> = MODEL_CONFIG;
const OP_LOOKUP: Record<string, { severity: AuditSeverityType; title: string }> = OP_MAP;

export const auditMapper = {
  toDto(log: AuditLog): AuditLogType {
    const parsedPayload = AuditPayloadSchema.safeParse(log.payload);
    const rawPayload: AuditPayload = parsedPayload.success ? parsedPayload.data : {};
    const data = rawPayload.data ?? {};
    const where = rawPayload.where ?? {};

    const browserDisplay = formatUserAgent(log.userAgent);
    const sanitizedPayload = sanitizeObject(rawPayload);

    const parser = new UAParser(log.userAgent ?? "");
    const device = parser.getDevice();

    let deviceType: AuditLogType["deviceType"] = "desktop";
    if (log.userAgent === "internal") {
      deviceType = "system";
    } else if (device.type === "mobile") {
      deviceType = "mobile";
    } else if (device.type === "tablet") {
      deviceType = "tablet";
    }

    const config = MODEL_LOOKUP[log.model] ?? { icon: "database", name: log.model };
    const op = OP_LOOKUP[log.operation] ?? { severity: "info", title: log.operation };

    let targetName;
    switch (log.model) {
      case "Repo": {
        targetName =
          getStr(data.fullName) ?? getStr(data.name) ?? getStr(where.name) ?? "Repository";
        break;
      }
      case "ApiKey": {
        targetName = getStr(data.name) ?? getStr(where.name) ?? "API Key";
        break;
      }
      case "User": {
        targetName =
          getStr(data.name) ??
          (typeof where.id === "string" ? `User ${where.id.slice(0, 8)}` : "Personal Profile");
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
      case "BannedEmail":
      case "ChatMessage":
      case "ChatSession":
      case "Document":
      case "GeneratedFix":
      case "Notification":
      case "Passkey":
      case "PullRequestAnalysis":
      case "PullRequestAnalysisConfig":
      case "PullRequestComment":
      case "Session":
      case "TwoFactor":
      case "Verification":
      case "WebhookDelivery":
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

    const reasonIndex = details.findIndex((detail) => detail.label === "ban reason");
    if (reasonIndex > 0) {
      details.unshift(...details.splice(reasonIndex, 1));
    }

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
  },
};
