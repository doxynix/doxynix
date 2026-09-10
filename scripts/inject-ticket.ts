import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

export function injectTicketIntoCommitMessage(content: string, branchName: string): string {
  if (/^(Merge|Revert|fixup!|squash!)/i.test(content)) {
    return content;
  }

  const issueMatch = branchName.match(/(dxnx-\d+)/i);
  if (!issueMatch) {
    return content;
  }

  const issueKey = issueMatch[1].toUpperCase();
  if (content.includes(issueKey)) {
    return content;
  }

  return `${content.trimEnd()}\n\nCloses ${issueKey}\n`;
}

export function addTicketToCommitMessage(commitMsgFile: string): boolean {
  try {
    const content = readFileSync(commitMsgFile, "utf8");
    const branchName = execSync("git branch --show-current", { encoding: "utf8" }).trim();
    const nextContent = injectTicketIntoCommitMessage(content, branchName);

    if (nextContent !== content) {
      writeFileSync(commitMsgFile, nextContent, "utf8");
    }

    return true;
  } catch {
    return true;
  }
}

if (import.meta.main) {
  const commitMsgFile = process.argv[2];
  if (!commitMsgFile) {
    process.exit(0);
  }

  process.exit(addTicketToCommitMessage(commitMsgFile) ? 0 : 1);
}
