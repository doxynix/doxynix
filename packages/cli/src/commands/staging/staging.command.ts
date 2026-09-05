import fs from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";
import { resolveRepository } from "@/core/repo";

import { brand, pc } from "@/ui/colors";

import { renderStagedFilesTable } from "./staging.formatter";
import { stagingService } from "./staging.service";

export function registerStagingCommand(program: Command) {
  const staging = program
    .command("staging")
    .alias("stage")
    .description("Manage cloud staging area of staged code changes before PR creation");

  // dxnx staging list [target]
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

        const s = p.spinner();
        if (!options?.json) {
          s.start(`Fetching staged files for ${repoContext.target}...`);
        }
        const staged = await stagingService.getStagedFiles(repoContext.repo.id);
        if (!options?.json) {
          s.stop("Staged files loaded");
        }

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

  // dxnx staging add <filePath>
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

        const s = p.spinner();
        s.start(`Uploading ${pc.cyan(filePath)} to staging...`);
        const res = await stagingService.stageFile(repoContext.repo.id, filePath, content);
        s.stop("Staged successfully!");

        p.outro(
          brand.success(
            `✔ Staged ${brand.highlight(filePath)} (${res.stagedCount} files currently staged in ${repoContext.target}).`,
          ),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx staging drop <filePath>
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

        const s = p.spinner();
        s.start(`Unstaging ${filePath}...`);
        const res = await stagingService.unstageFile(repoContext.repo.id, filePath);
        s.stop("File removed from staging");

        p.outro(
          brand.success(
            `✔ Removed ${brand.highlight(filePath)} from staging (${res.stagedCount} remaining).`,
          ),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx staging clear
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

        const s = p.spinner();
        s.start("Clearing staging workspace...");
        await stagingService.clearStaging(repoContext.repo.id);
        s.stop("Staging cleared!");

        p.outro(
          brand.success(`✔ All staged changes cleared for ${brand.highlight(repoContext.target)}.`),
        );
      } catch (error) {
        handleCliError(error);
      }
    });
}
