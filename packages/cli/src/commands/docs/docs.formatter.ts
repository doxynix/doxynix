import { brand, pc } from "@/ui/colors";
import { createTable } from "@/ui/table";

import { type DocListItem } from "./docs.types";

export function formatDocType(type: string): string {
  switch (type?.toUpperCase()) {
    case "README": {
      return pc.magenta(pc.bold("📘 README"));
    }
    case "ARCHITECTURE": {
      return pc.cyan(pc.bold("🏛️ ARCHITECTURE"));
    }
    case "CODE_DOC": {
      return pc.yellow(pc.bold("📄 CODE_DOC"));
    }
    default: {
      return brand.info(type ?? "DOC");
    }
  }
}

export function renderDocsListTable(docs: DocListItem[]): string {
  const table = createTable(["Type", "Target / Path", "Version / Commit", "Updated"]);

  for (const doc of docs) {
    const docType = formatDocType(doc.type);
    const path = doc.path ? brand.highlight(doc.path) : brand.muted("Global Document");
    const version = doc.version ? brand.info(doc.version.slice(0, 8)) : brand.muted("Latest");
    const updated = doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : "—";

    table.push([docType, path, version, brand.muted(updated)]);
  }

  return table.toString();
}
