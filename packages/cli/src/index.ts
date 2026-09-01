import pkg from "@pkg";
import { Command } from "commander";

import { registerAgentCommand } from "./commands/agent/agent.command";
import { registerAnalyzeCommand } from "./commands/analyze/analyze.command";
import { registerAuthCommands } from "./commands/auth/auth.command";
import { registerKeysCommand } from "./commands/keys/keys.command";
import { registerNotificationsCommand } from "./commands/notifications/notifications.command";
import { registerProfileCommand } from "./commands/profile/profile.command";
import { registerReposCommand } from "./commands/repos/repos.command";
import { registerSystemCommands } from "./commands/system/status.command";
import { brand } from "./ui/colors";

const program = new Command();

program
  .name("dxnx")
  .description("⌨️  Doxynix Platform CLI — Developer & Security Companion")
  .version(pkg.version, "-v, --version", "Display current CLI version");

registerAuthCommands(program);
registerProfileCommand(program);
registerKeysCommand(program);
registerReposCommand(program);
registerAnalyzeCommand(program);
registerNotificationsCommand(program);
registerSystemCommands(program);
registerAgentCommand(program);

process.on("SIGINT", () => {
  console.log(brand.muted("\n\nProcess terminated by user."));
  process.exit(0);
});

await program.parseAsync(process.argv);
