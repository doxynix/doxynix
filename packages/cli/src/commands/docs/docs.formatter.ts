import { brand, pc } from "@/ui/colors";
import { formatRelativeTime } from "@/ui/formatters";
import { icons } from "@/ui/icons";
import { createTable } from "@/ui/table";

import type { DocListItem } from "./docs.types";

export function formatDocType(type: string): string {
  switch (type?.toUpperCase()) {
    case "README": {
      return pc.magenta(pc.bold(`${icons.doc} README`));
    }
    case "ARCHITECTURE": {
      return pc.cyan(pc.bold(`${icons.package} ARCHITECTURE`));
    }
    case "CODE_DOC": {
      return pc.yellow(pc.bold(`${icons.bullet} CODE_DOC`));
    }
    default: {
      return brand.info(`${icons.doc} ${type ?? "DOC"}`);
    }
  }
}

export function renderDocsListTable(docs: DocListItem[]): string {
  const table = createTable(["Type", "Target / Path", "Version / Commit", "Updated"]);

  for (const doc of docs) {
    const docType = formatDocType(doc.type);
    const path = doc.path ? brand.highlight(doc.path) : brand.muted("Global Document");
    const version = doc.version ? brand.info(doc.version.slice(0, 8)) : brand.muted("Latest");
    const updated = formatRelativeTime(doc.updatedAt);

    table.push([docType, path, version, brand.muted(updated)]);
  }

  return table.toString();
}
