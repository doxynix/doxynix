import { readFileSync } from "node:fs";

const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  console.error("❌ Error: No commit message file provided.");
  process.exit(1);
}

const commitMsg = readFileSync(commitMsgFile, "utf8").trim();

if (/^(Merge branch|Merge remote-tracking branch|Rebase|fixup!|squash!)/i.test(commitMsg)) {
  process.exit(0);
}

const lines = commitMsg.split("\n");
const firstLine = lines[0]?.trim();

if (!firstLine) {
  console.error("❌ Error: Commit message subject cannot be empty!");
  process.exit(1);
}

if (firstLine.length > 72) {
  console.error(
    `❌ Error: Commit subject is too long (${firstLine.length} chars). Maximum allowed is 72.`,
  );
  console.error(`👉 "${firstLine}"`);
  process.exit(1);
}

if (firstLine.endsWith(".")) {
  console.error("❌ Error: Commit subject line must not end with a period.");
  process.exit(1);
}

const conventionalRegex =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9_.-]+\))?!?: .+/;

if (!conventionalRegex.test(firstLine)) {
  console.error("❌ Error: Commit message does not match the Conventional Commits specification!");
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
  console.error(`\n❌ Your message: "${firstLine}"`);
  process.exit(1);
}

process.exit(0);
