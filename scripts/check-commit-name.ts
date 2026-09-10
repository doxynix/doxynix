import { readFileSync } from "node:fs";

export function validateCommitMessage(commitMessage: string): { valid: boolean; reason?: string } {
  const trimmed = commitMessage.trim();

  if (/^(Merge branch|Merge remote-tracking branch|Rebase|fixup!|squash!)/i.test(trimmed)) {
    return { valid: true };
  }

  const lines = trimmed.split("\n");
  const firstLine = lines[0]?.trim();

  if (!firstLine) {
    return { reason: "Commit message subject cannot be empty!", valid: false };
  }

  if (firstLine.length > 72) {
    return {
      reason: `Commit subject is too long (${firstLine.length} chars). Maximum allowed is 72.`,
      valid: false,
    };
  }

  if (firstLine.endsWith(".")) {
    return { reason: "Commit subject line must not end with a period.", valid: false };
  }

  const conventionalRegex =
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9_.-]+\))?!?: .+/;

  if (!conventionalRegex.test(firstLine)) {
    return {
      reason: "Commit message does not match the Conventional Commits specification!",
      valid: false,
    };
  }

  return { valid: true };
}

export function checkCommitName(commitMsgFile?: string): boolean {
  if (!commitMsgFile) {
    console.error("❌ Error: No commit message file provided.");
    return false;
  }

  const commitMsg = readFileSync(commitMsgFile, "utf8").trim();
  const result = validateCommitMessage(commitMsg);

  if (!result.valid) {
    console.error(`❌ Error: ${result.reason}`);
    if (result.reason !== "Commit message subject cannot be empty!") {
      console.error("\n⚙️  Correct format:");
      console.error("   type(scope): description   OR   type: description");
      console.error("\n📋 Allowed types:");
      console.error("   feat     - A new feature");
      console.error("   fix      - A bug fix");
      console.error("   chore    - Build process, dependency updates, or auxiliary tool changes");
      console.error("   docs     - Documentation changes only");
      console.error("   refactor - A code change that neither fixes a bug nor adds a feature");
      console.error("   test     - Adding missing tests or correcting existing tests");
      console.error(
        "   style    - Changes that do not affect the meaning of the code (white-space, formatting)",
      );
      console.error("   perf     - A code change that improves performance");
      console.error("   ci       - Changes to CI configuration files and scripts");
      console.error("\n📝 Example: feat(auth): add login validation");
      console.error(`\n❌ Your message: "${commitMsg.split("\n")[0]?.trim() ?? ""}"`);
    }
    return false;
  }

  return true;
}

if (import.meta.main) {
  const commitMsgFile = process.argv[2];
  process.exit(checkCommitName(commitMsgFile) ? 0 : 1);
}
