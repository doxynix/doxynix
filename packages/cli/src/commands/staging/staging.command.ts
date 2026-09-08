import fs from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";
import { type Command } from "commander";

import { handleCliError } from "@/core/errors";
import { resolveRepository } from "@/core/repo";

import { brand, pc } from "@/ui/colors";
import { withTaskSpinner } from "@/ui/spinner";

import { renderStagedFilesTable } from "./staging.formatter";
import { stagingService } from "./staging.service";

export function registerStagingCommand(program: Command) {
  const staging = program
    .command("staging")
    .alias("stage")
    .description("Manage cloud staging area of staged code changes before PR creation");

  staging
    .command("list [target]", { isDefault: true })
    .description("View all files currently staged in cloud for PR creation")
    .option("--json", "Output staged files in raw JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
      try {
        const repoContext = await resolveRepository(target, "Select repository staging workspace:");
        if (!repoContext) {
          return;
        }

        const staged = await withTaskSpinner(
          {
            silent: options?.json,
            start: `Fetching staged files for ${repoContext.target}...`,
            stop: "Staged files loaded",
          },
          () => stagingService.getStagedFiles(repoContext.repo.id),
        );

        if (options?.json) {
          console.log(JSON.stringify(staged, null, 2));
          return;
        }

        const count = Array.isArray(staged) ? staged.length : Object.keys(staged ?? {}).length;
        if (count === 0) {
          p.outro(
            brand.muted(`No files staged for ${repoContext.target}.\n`) +
              brand.muted("Stage a file with: ") +
              brand.highlight(`dxnx staging add <file> -r ${repoContext.target}`),
          );
          return;
        }

        console.log(`\n${brand.logo(` 📦 Cloud Staging Area: ${repoContext.target}\n`)}`);
        console.log(renderStagedFilesTable(staged));
        console.log("\n");
        p.outro(
          brand.muted(`Total staged files: ${count}. Open PR with: `) +
            brand.highlight(`dxnx pr open ${repoContext.target}`),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  staging
    .command("add <filePath>")
    .description("Stage a local file change into the cloud PR staging basket")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .action(async (filePath: string, options: { repo?: string }) => {
      try {
        p.intro(brand.logo(" ➕ Stage File "));
        const repoContext = await resolveRepository(options.repo);
        if (!repoContext) {
          return;
        }

        const localPath = path.resolve(process.cwd(), filePath);
        let content = "";
        if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
          content = fs.readFileSync(localPath, "utf-8");
        } else {
          const inputContent = await p.text({
            message: `File '${filePath}' not found locally. Paste file content:`,
            validate: (v) => (!v?.trim() ? "Content cannot be empty" : undefined),
          });
          if (p.isCancel(inputContent)) {
            return p.cancel("Cancelled.");
          }
          content = inputContent;
        }

        const res = await withTaskSpinner(
          {
            start: `Uploading ${pc.cyan(filePath)} to staging...`,
            stop: "Staged successfully!",
          },
          () => stagingService.stageFile(repoContext.repo.id, filePath, content),
        );

        p.outro(
          brand.success(
            `✔ Staged ${brand.highlight(filePath)} (${res.stagedCount} files currently staged in ${repoContext.target}).`,
          ),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  staging
    .command("drop <filePath>")
    .alias("unstage")
    .description("Remove a file from the staging area")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .action(async (filePath: string, options: { repo?: string }) => {
      try {
        const repoContext = await resolveRepository(options.repo);
        if (!repoContext) {
          return;
        }

        const res = await withTaskSpinner(
          {
            start: `Unstaging ${filePath}...`,
            stop: "File removed from staging",
          },
          () => stagingService.unstageFile(repoContext.repo.id, filePath),
        );

        p.outro(
          brand.success(
            `✔ Removed ${brand.highlight(filePath)} from staging (${res.stagedCount} remaining).`,
          ),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  staging
    .command("clear")
    .description("Clear and discard all staged changes for repository")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .action(async (options: { repo?: string }) => {
      try {
        p.intro(brand.warning(" 🧹 Clear Staging Area "));
        const repoContext = await resolveRepository(options.repo);
        if (!repoContext) {
          return;
        }

        const confirmed = await p.confirm({
          message: `Are you sure you want to discard all staged files for ${brand.highlight(repoContext.target)}?`,
        });
        if (!confirmed || p.isCancel(confirmed)) {
          return p.outro(brand.muted("Cancelled."));
        }

        await withTaskSpinner(
          {
            start: "Clearing staging workspace...",
            stop: "Staging cleared!",
          },
          () => stagingService.clearStaging(repoContext.repo.id),
        );

        p.outro(
          brand.success(`✔ All staged changes cleared for ${brand.highlight(repoContext.target)}.`),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  staging
    .command("add-fix <fixId>")
    .alias("stage-fix")
    .description("Stage all files from an AI-generated fix into the cloud staging basket")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .action(async (fixId: string, options: { repo?: string }) => {
      try {
        p.intro(brand.logo(" 📦 Stage AI Generated Fix "));

        const repoContext = await resolveRepository(
          options.repo,
          "Select repository context for this fix:",
        );
        if (!repoContext) {
          return;
        }

        const res = await withTaskSpinner(
          {
            start: `Moving fix ${brand.highlight(fixId)} files into staging basket...`,
            stop: "Fix staged successfully!",
          },
          () => stagingService.stageGeneratedFix(repoContext.repo.id, fixId),
        );

        p.note(
          `Staged Files Added: ${brand.highlight(String(res.stagedFilesAdded))}\n` +
            `Total Staged Files:  ${brand.info(String(res.stagedCount))}\n` +
            `Repository:          ${pc.cyan(repoContext.target)}`,
          "Staging Updated",
        );

        p.outro(
          brand.success(
            "✔ Fix is now staged! Review changes with " +
              brand.highlight(`dxnx staging list ${repoContext.target}`) +
              " or open PR with " +
              brand.highlight(`dxnx pr open ${repoContext.target}`),
          ),
        );
      } catch (error) {
        handleCliError(error);
      }
    });
}
