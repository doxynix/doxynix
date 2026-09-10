import { brand, pc } from "@/ui/colors";
import { createTable } from "@/ui/table";

import type { StagedFilesMap } from "./staging.types";

export function renderStagedFilesTable(staged: StagedFilesMap): string {
  const table = createTable(["File Path", "Size", "Lines Count"]);

  for (const [filePath, file] of Object.entries(staged ?? {})) {
    const content = file.content;
    const lines = content ? content.split("\n").length : 0;
    const bytes = Buffer.byteLength(content, "utf8");

    table.push([brand.highlight(filePath), brand.info(`${bytes} B`), pc.yellow(`${lines} lines`)]);
  }

  return table.toString();
}
