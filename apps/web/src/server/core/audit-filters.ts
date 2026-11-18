// Writes whose only purpose is bookkeeping: they carry no information a human would audit.
const BOOKKEEPING_FIELDS: Record<string, readonly string[]> = {
  Analysis: ["progress"],
  ApiKey: ["lastUsed"],
  Notification: ["isRead"],
};

function singleDataKey(args: unknown): string | undefined {
  if (typeof args !== "object" || args === null) {
    return undefined;
  }

  const { data } = args as { data?: unknown };
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return undefined;
  }

  const keys = Object.keys(data);
  return keys.length === 1 ? keys[0] : undefined;
}

export function isBookkeepingWrite(model: string, operation: string, args: unknown): boolean {
  if (operation !== "update" && operation !== "updateMany") {
    return false;
  }

  const fields = BOOKKEEPING_FIELDS[model];
  if (fields == null) {
    return false;
  }

  const field = singleDataKey(args);
  return field != null && fields.includes(field);
}

// One publish per request: the client invalidates the same audit query either way. The flag is spent
// before the publish resolves, so a failed publish stays quiet for the rest of the request.
export function shouldPublishAuditUpdated(
  store: { auditRealtime?: { published: boolean } } | null | undefined,
): boolean {
  if (store == null) {
    return true;
  }

  if (store.auditRealtime == null) {
    return true;
  }

  if (store.auditRealtime.published) {
    return false;
  }

  store.auditRealtime.published = true;
  return true;
}
