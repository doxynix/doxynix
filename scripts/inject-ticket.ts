import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const commitMsgFile = process.argv[2];
if (!commitMsgFile) process.exit(0);

try {
  const content = readFileSync(commitMsgFile, "utf8");

  if (/^(Merge|Revert|fixup!|squash!)/i.test(content)) {
    process.exit(0);
  }

  const branchName = execSync("git branch --show-current", { encoding: "utf8" }).trim();

  const issueMatch = branchName.match(/([A-Za-z]+-\d+)/);

  if (issueMatch) {
    const issueKey = issueMatch[1]?.toUpperCase();

    if (!content.includes(issueKey ?? "")) {
      const lines = content.split("\n");
      lines[0] = `${lines[0]?.trim()} (${issueKey})`;

      writeFileSync(commitMsgFile, lines.join("\n"), "utf8");
    }
  }
} catch {
  process.exit(0);
}
