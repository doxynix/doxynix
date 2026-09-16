export function preprocessMermaidChart(
  chart: string,
  buildHref?: (path: string) => string,
): string {
  const lines = chart.split("\n");

  const firstLine =
    lines
      .find((line) => line.trim().length > 0)
      ?.trim()
      .toLowerCase() || "";

  const isFlowchart = firstLine.startsWith("graph") || firstLine.startsWith("flowchart");

  const clickLines: string[] = [];
  const processedLines: string[] = [];

  for (const line of lines) {
    const match = /\[\[([\w./-]+)]]/.exec(line);

    if (match != null) {
      const path = match[1];

      if (path == null) {
        processedLines.push(line);
        continue;
      }

      const cleanedLine = line.replace(`[[${path}]]`, path);
      processedLines.push(cleanedLine);

      if (isFlowchart) {
        const nodeMatch = /^\s*([\w-]+)/.exec(line);
        if (nodeMatch != null) {
          const nodeId = nodeMatch[1];

          if (nodeId == null) {
            continue;
          }

          const href =
            buildHref != null ? buildHref(path) : `/code?node=file:${encodeURIComponent(path)}`;
          clickLines.push(`  click ${nodeId} "${href}" "Explore ${path}"`);
        }
      }
    } else {
      processedLines.push(line);
    }
  }

  return [...processedLines, ...clickLines].join("\n");
}
