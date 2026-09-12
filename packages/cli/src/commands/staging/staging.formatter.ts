import { brand, pc } from "@/ui/colors";
import { createTable } from "@/ui/table";

import type { StagedFilesMap } from "./staging.types";

type StagedArrayItem = {
  content?: null | string;
  filePath?: string;
  path?: string;
};

export function renderStagedFilesTable(staged: StagedFilesMap): string {
  const table = createTable(["File Path", "Size", "Lines Count"]);

  if (!staged) {
    return table.toString();
  }

  if (Array.isArray(staged)) {
    for (const rawItem of staged) {
      const item = rawItem as StagedArrayItem;
      const filePath = item.filePath ?? item.path ?? "unknown";
      const content = typeof item.content === "string" ? item.content : "";
      const lines = content ? content.split("\n").length : 0;
      const bytes = Buffer.byteLength(content, "utf8");

      table.push([
        brand.highlight(filePath),
        brand.info(`${bytes} B`),
        pc.yellow(`${lines} lines`),
      ]);
    }
    return table.toString();
  }

  for (const [filePath, rawFile] of Object.entries(staged)) {
    const file =
      typeof rawFile === "object" && rawFile !== null
        ? (rawFile as { content?: unknown })
        : undefined;
    const content = typeof file?.content === "string" ? file.content : "";
    const lines = content ? content.split("\n").length : 0;
    const bytes = Buffer.byteLength(content, "utf8");

    table.push([brand.highlight(filePath), brand.info(`${bytes} B`), pc.yellow(`${lines} lines`)]);
  }

  return table.toString();
}
