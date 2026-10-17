import { type Command, Option } from "commander";

const YES_OPTION_DESCRIPTION =
  "Skip the confirmation prompt (non-destructive actions). Implied by CI=true.";
const FORCE_OPTION_DESCRIPTION =
  "Skip the confirmation prompt without exception, including destructive actions.";

function registerConfirmFlags(command: Command): void {
  command.addOption(new Option("-y, --yes", YES_OPTION_DESCRIPTION));
  command.addOption(new Option("--force", FORCE_OPTION_DESCRIPTION));
}

// Commander rejects undeclared options before the action body runs, so every command
// needs the flags `confirmOrAbort` reads out of `process.argv`.
export function registerConfirmFlagsRecursively(command: Command): void {
  registerConfirmFlags(command);

  for (const sub of command.commands) {
    registerConfirmFlagsRecursively(sub);
  }
}
