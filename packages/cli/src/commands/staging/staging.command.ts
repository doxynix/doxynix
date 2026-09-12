import * as p from "@clack/prompts";
import type { Command } from "commander";

import { readFileOrPrompt } from "@/core/fs";
import { confirmOrAbort, resolveEntityOrPick } from "@/core/prompts";
import { resolveRepository } from "@/core/repo";

import { brand, pc } from "@/ui/colors";
import { renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
import { withTaskSpinner } from "@/ui/spinner";

import { prService } from "../pr/pr.service";
import type { FixItem } from "../pr/pr.types";
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

      if (output.json(staged, options?.json)) {
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

      console.log(
        renderSection(
          brand.logo(`Cloud Staging Area: ${repoContext.target}`),
          renderStagedFilesTable(staged),
        ),
      );
      p.outro(
        brand.muted(`Total staged files: ${count}. Open PR with: `) +
          brand.highlight(`dxnx pr open ${repoContext.target}`),
      );
    });

  staging
    .command("add <filePath>")
    .description("Stage a local file change into the cloud PR staging basket")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .action(async (filePath: string, options: { repo?: string }) => {
      p.intro(brand.logo("Stage File "));
      const repoContext = await resolveRepository(options.repo);
      if (!repoContext) {
        return;
      }

      const content = await readFileOrPrompt(filePath);
      if (!content) {
        return;
      }

      const result = await withTaskSpinner(
        {
          start: `Uploading ${pc.cyan(filePath)} to staging...`,
          stop: "Staged successfully!",
        },
        () => stagingService.stageFile(repoContext.repo.id, filePath, content),
      );

      p.outro(
        brand.success(
          ` Staged ${brand.highlight(filePath)} (${result.stagedCount} files currently staged in ${repoContext.target}).`,
        ),
      );
    });

  staging
    .command("drop <filePath>")
    .alias("unstage")
    .description("Remove a file from the staging area")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .action(async (filePath: string, options: { repo?: string }) => {
      const repoContext = await resolveRepository(options.repo);
      if (!repoContext) {
        return;
      }

      const result = await withTaskSpinner(
        {
          start: `Unstaging ${filePath}...`,
          stop: "File removed from staging",
        },
        () => stagingService.unstageFile(repoContext.repo.id, filePath),
      );

      p.outro(
        brand.success(
          ` Removed ${brand.highlight(filePath)} from staging (${result.stagedCount} remaining).`,
        ),
      );
    });

  staging
    .command("clear")
    .description("Clear and discard all staged changes for repository")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .action(async (options: { repo?: string }) => {
      p.intro(brand.warning("  Clear Staging Area "));
      const repoContext = await resolveRepository(options.repo);
      if (!repoContext) {
        return;
      }

      const confirmed = await confirmOrAbort({
        cancelMessage: "Cancelled.",
        message: `Are you sure you want to discard all staged files for ${brand.highlight(repoContext.target)}?`,
      });

      if (!confirmed) {
        return;
      }

      await withTaskSpinner(
        {
          start: "Clearing staging workspace...",
          stop: "Staging cleared!",
        },
        () => stagingService.clearStaging(repoContext.repo.id),
      );

      p.outro(
        brand.success(` All staged changes cleared for ${brand.highlight(repoContext.target)}.`),
      );
    });

  staging
    .command("add-fix [fixId]")
    .alias("stage-fix")
    .description(
      "Stage all files from an AI-generated fix into the cloud staging basket (supports Short-ID and picker)",
    )
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .action(async (fixId?: string, options?: { repo?: string }) => {
      p.intro(brand.logo("  Stage AI Generated Fix "));

      const repoContext = await resolveRepository(
        options?.repo,
        "Select repository context for this fix:",
      );
      if (!repoContext) {
        return;
      }

      const targetFixId = await resolveEntityOrPick({
        cancelMessage: "Staging cancelled.",
        emptyMessage: `No AI-generated fixes found for ${repoContext.target}.`,
        fetchItems: () =>
          withTaskSpinner("Loading AI-generated fixes...", () =>
            prService.getFixes(repoContext.repo.id),
          ),
        getLabel: (f: FixItem) =>
          `${f.title ?? "AI Suggested Fix"} [${f.status}] (${f.id.slice(0, 8)})`,
        idArg: fixId,
        notFoundMessage: (prefix) => `No fix found matching prefix: '${prefix}'`,
        selectMessage: "Select an AI Code Fix to stage:",
      });

      if (!targetFixId) {
        return;
      }

      const result = await withTaskSpinner(
        {
          start: `Moving fix ${brand.highlight(targetFixId.slice(0, 8))} files into staging basket...`,
          stop: "Fix staged successfully!",
        },
        () => stagingService.stageGeneratedFix(repoContext.repo.id, targetFixId),
      );

      p.note(
        `Staged Files Added: ${brand.highlight(String(result.stagedFilesAdded))}\n` +
          `Total Staged Files:  ${brand.info(String(result.stagedCount))}\n` +
          `Repository:          ${pc.cyan(repoContext.target)}`,
        "Staging Updated",
      );

      p.outro(
        brand.success(
          " Fix is now staged! Review changes with " +
            brand.highlight(`dxnx staging list ${repoContext.target}`) +
            " or open PR with " +
            brand.highlight(`dxnx pr open ${repoContext.target}`),
        ),
      );
    });
}
