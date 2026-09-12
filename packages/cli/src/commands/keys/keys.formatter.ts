import { brand } from "@/ui/colors";
import { formatRelativeTime } from "@/ui/formatters";
import { createTable } from "@/ui/table";

import type { ApiKeyItem } from "./keys.types";

export function renderKeysTable(keys: ApiKeyItem[]): string {
  const table = createTable(["ID (UUID)", "Name", "Prefix", "Created", "Last Used", "Status"]);

  for (const k of keys) {
    table.push([
      brand.muted(`${k.id.slice(0, 8)}...`),
      brand.highlight(k.name),
      brand.info(`${k.prefix}••••`),
      brand.muted(formatRelativeTime(k.createdAt)),
      k.lastUsed ? formatRelativeTime(k.lastUsed) : brand.muted("Never"),
      k.revoked ? brand.error("Revoked") : brand.success("Active"),
    ]);
  }

  return table.toString();
}
