export function getToolBaseLabel(toolName: string, toolLabels: Record<string, string>): string {
  return toolLabels[toolName] ?? `Executing ${toolName.replaceAll(/([A-Z])/g, " $1").trim()}`;
}

export function getDynamicToolContext(toolName: string, args: unknown): null | string {
  if (args == null || typeof args !== "object") {
    return null;
  }

  const record = args as Record<string, unknown>;

  switch (toolName) {
    case "getFileContent":
    case "quickFileAudit":
    case "documentFile":
    case "stageFile":
    case "unstageFile": {
      const path = record.path ?? record.filePath;
      return typeof path === "string" ? path : null;
    }
    case "readMultipleFiles": {
      return Array.isArray(record.paths) ? record.paths.join(", ") : null;
    }
    case "searchWorkspace":
    case "searchCode": {
      return record.search != null ? `"${String(record.search)}"` : null;
    }
    case "getBranches":
    case "getRepoFiles": {
      return record.name != null ? `${String(record.owner)}/${String(record.name)}` : null;
    }
    case "openPullRequest":
    case "applyFix": {
      const title = record.title;
      return typeof title === "string" ? title : null;
    }
    default: {
      return null;
    }
  }
}
