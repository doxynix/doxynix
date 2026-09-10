import { brand, pc } from "@/ui/colors";
import { createTable } from "@/ui/table";

import type { ChatSessionItem } from "./agent.types";

export function renderSessionsTable(sessions: ChatSessionItem[]): string {
  const table = createTable(["Session ID", "Title", "Repository Context", "Updated"]);

  for (const session of sessions) {
    const repoLabel = session.repo
      ? `${session.repo.owner}/${session.repo.name}`
      : "Global Platform";

    table.push([
      brand.muted(`${session.id.slice(0, 8)}...`),
      brand.highlight(session.title),
      session.repo ? pc.cyan(repoLabel) : brand.muted(repoLabel),
      brand.muted(new Date(session.updatedAt).toLocaleDateString()),
    ]);
  }

  return table.toString();
}

export function extractMessageContent(parts: unknown): string {
  if (Array.isArray(parts)) {
    return parts
      .map((part) => {
        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (typeof parts === "string") {
    return parts;
  }
  return "—";
}
