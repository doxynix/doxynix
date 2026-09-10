import { execSync } from "node:child_process";

export function validateBranchName(branchName: string): boolean {
  if (!branchName || ["main", "master", "dev", "development"].includes(branchName)) {
    return true;
  }

  const requiredPrefixRegex = /^(dxnx\/|[a-zA-Z0-9_.-]+\/dxnx[-_]|dxnx[-_])/i;
  return requiredPrefixRegex.test(branchName);
}

export function checkBranchName(): boolean {
  try {
    const branchName = execSync("git branch --show-current", { encoding: "utf8" }).trim();

    if (!validateBranchName(branchName)) {
      console.error("\n❌ Git Branch Naming Violation!");
      console.error(`👉 Your current branch: "${branchName}"`);
      console.error("⚠️  Branch name MUST start with or include the 'dxnx' prefix.\n");
      console.error("⚙️  Correct branch name examples:");
      console.error("   dxnx/feat-add-scanner      |   feat/dxnx-123-add-rules");
      console.error("   dxnx-add-auth-middleware\n");
      console.error("💡 Rename your branch using:");
      console.error(`   git branch -m dxnx/${branchName}\n`);
      return false;
    }

    return true;
  } catch {
    console.error("Branch check failed: unable to determine the current Git branch.");
    return false;
  }
}

if (import.meta.main) {
  process.exit(checkBranchName() ? 0 : 1);
}
