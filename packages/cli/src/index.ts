import * as p from "@clack/prompts";
import pkg from "@pkg";
import { Command } from "commander";

import { registerAgentCommand } from "./commands/agent/agent.command";
import { registerAnalyticsCommand } from "./commands/analytics/analytics.command";
import { registerAnalyzeCommand } from "./commands/analyze/analyze.command";
import { registerAuditCommand } from "./commands/audit/audit.command";
import { registerAuthCommands } from "./commands/auth/auth.command";
import { registerDocsCommand } from "./commands/docs/docs.command";
import { registerGithubCommand } from "./commands/github/github.command";
import { registerKeysCommand } from "./commands/keys/keys.command";
import { registerNotificationsCommand } from "./commands/notifications/notifications.command";
import { registerPrCommand } from "./commands/pr/pr.command";
import { registerProfileCommand } from "./commands/profile/profile.command";
import { registerReposCommand } from "./commands/repos/repos.command";
import { registerStagingCommand } from "./commands/staging/staging.command";
import { registerSystemCommands } from "./commands/system/system.command";
import { handleCliError } from "./core/errors";
import { checkCliUpdate } from "./core/updater";

const program = new Command();

program
  .name("dxnx")
  .description("Doxynix Platform CLI — Developer & Security Companion")
  .version(pkg.version, "-v, --version", "Display current CLI version");

registerAuthCommands(program);
registerProfileCommand(program);
registerKeysCommand(program);
registerReposCommand(program);
registerAnalyzeCommand(program);
registerNotificationsCommand(program);
registerSystemCommands(program);
registerAgentCommand(program);
registerAnalyticsCommand(program);
registerAuditCommand(program);
registerGithubCommand(program);
registerDocsCommand(program);
registerStagingCommand(program);
registerPrCommand(program);

process.on("SIGINT", () => {
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
    process.stdin.setRawMode(false);
  }
  process.stderr.write("\x1B[?25h");
  p.cancel("Process terminated by user.");
  process.exit(130);
});

try {
  await program.parseAsync(process.argv);
  checkCliUpdate(pkg.version);
} catch (error) {
  handleCliError(error);
}
