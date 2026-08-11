import { execSync } from "node:child_process";

try {
  const branchName = execSync("git branch --show-current", { encoding: "utf8" }).trim();

  if (!branchName || ["main", "master", "dev", "development"].includes(branchName)) {
    process.exit(0);
  }

  const requiredPrefixRegex = /^(siem\/|dxnx\/|([a-zA-Z0-9]+)\/(siem|dxnx)[-_]|(siem|dxnx)[-_])/i;

  if (!requiredPrefixRegex.test(branchName)) {
    console.error("\n❌ Git Branch Naming Violation!");
    console.error(`👉 Your current branch: "${branchName}"`);
    console.error("⚠️  Branch name MUST start with or include the 'siem' or 'dxnx' prefix.\n");
    console.error("⚙️  Correct branch name examples:");
    console.error("   siem/feat-add-scanner      |   dxnx/feat-add-scanner");
    console.error("   feat/siem-123-add-rules    |   feat/dxnx-123-add-rules");
    console.error("   siem-add-auth-middleware   |   dxnx-add-auth-middleware\n");
    console.error("💡 Rename your branch using:");
    console.error(`   git branch -m <dxnx|siem>/${branchName}\n`);
    process.exit(1);
  }
} catch {
  console.error("Branch check failed: unable to determine the current Git branch.");
  process.exit(1);
}

process.exit(0);
