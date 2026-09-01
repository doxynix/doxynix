import type { RouterOutput } from "@/core/client";

import { brand } from "@/ui/colors";
import { createTable } from "@/ui/table";

export type ApiKeyItem = RouterOutput["apikey"]["list"]["active"][number];

export function renderKeysTable(keys: ApiKeyItem[]): string {
  const table = createTable(["ID (UUID)", "Name", "Prefix", "Created", "Last Used", "Status"]);

  for (const k of keys) {
    table.push([
      brand.muted(`${k.id.slice(0, 8)}...`),
      brand.highlight(k.name),
      brand.info(`${k.prefix}••••`),
      new Date(k.createdAt).toLocaleDateString(),
      k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : brand.muted("Never"),
      k.revoked ? brand.error("Revoked") : brand.success("Active"),
    ]);
  }

  return table.toString();
}
