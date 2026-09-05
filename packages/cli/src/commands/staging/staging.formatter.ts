import { brand, pc } from "@/ui/colors";
import { createTable } from "@/ui/table";

export function renderStagedFilesTable(staged: Record<string, string> | any[]): string {
  const table = createTable(["File Path", "Size", "Lines Count"]);

  const entries: [string, string][] = Array.isArray(staged)
    ? staged.map((item) => [item.filePath, item.content ?? ""])
    : Object.entries(staged ?? {});

  for (const [filePath, content] of entries) {
    const lines = content ? content.split("\n").length : 0;
    const bytes = Buffer.byteLength(content ?? "", "utf8");

    table.push([brand.highlight(filePath), brand.info(`${bytes} B`), pc.yellow(`${lines} lines`)]);
  }

  return table.toString();
}
