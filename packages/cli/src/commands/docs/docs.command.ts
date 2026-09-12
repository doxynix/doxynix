import path from "node:path";

import * as p from "@clack/prompts";
import type { Command } from "commander";

import { readFileOrPrompt, writeLocalFile } from "@/core/fs";
import { getCurrentGitBranch } from "@/core/git";
import { guardPrompt } from "@/core/prompts";
import { resolveRepository } from "@/core/repo";

import { brand, pc } from "@/ui/colors";
import { renderBlock, renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
import { withTaskSpinner } from "@/ui/spinner";

import { renderDocsListTable } from "./docs.formatter";
import { docsService } from "./docs.service";
import type { DocListItem, DocType } from "./docs.types";

export function registerDocsCommand(program: Command) {
  const docs = program
    .command("docs")
    .alias("doc")
    .description("Inspect, generate, and pin AI repository documentation");

  docs
    .command("list [target]", { isDefault: true })
    .description("List all generated documentation artifacts for a repository")
    .option("-a, --aid <analysisId>", "Specific analysis run ID")
    .option("--json", "Output response in JSON format")
    .action(async (target?: string, options?: { aid?: string; json?: boolean }) => {
      const repoContext = await resolveRepository(
        target,
        "Select repository to access documentation:",
      );
      if (!repoContext) {
        return;
      }

      const docsList = await withTaskSpinner(
        {
          silent: options?.json,
          start: `Fetching available docs for ${repoContext.target}...`,
          stop: "Documentation items retrieved",
        },
        () => docsService.getAvailableDocs(repoContext.repo.id, options?.aid),
      );

      if (output.json(docsList, options?.json)) {
        return;
      }

      const items: DocListItem[] = Array.isArray(docsList) ? docsList : [];

      if (items.length === 0) {
        p.outro(
          brand.warning(`No documentation found for ${repoContext.target}.\n`) +
            brand.muted("Run an analysis first with: ") +
            brand.highlight(`dxnx analyze start ${repoContext.target}`),
        );
        return;
      }

      console.log(
        renderSection(
          brand.logo(`  Available Documentation: ${repoContext.target}`),
          renderDocsListTable(items),
        ),
      );
      p.outro(
        brand.muted("View a document with: ") +
          brand.highlight(`dxnx docs view ${repoContext.target} --type README`),
      );
    });

  docs
    .command("view [target]")
    .alias("cat")
    .description("View or export markdown content of a generated document")
    .option("-t, --type <type>", "Document type: README, ARCHITECTURE, or CODE_DOC")
    .option("-p, --path <path>", "File path (for CODE_DOC items)")
    .option("-a, --aid <analysisId>", "Analysis run ID")
    .option("-o, --output <file>", "Save markdown output directly to a local file")
    .action(
      async (
        target?: string,
        options?: { aid?: string; output?: string; path?: string; type?: string },
      ) => {
        const repoContext = await resolveRepository(target);
        if (!repoContext) {
          return;
        }

        const DOC_TYPES: DocType[] = ["README", "ARCHITECTURE", "CODE_DOC"];
        let docType: DocType | undefined;

        if (options?.type) {
          const rawType = options.type.toUpperCase();
          if (!DOC_TYPES.includes(rawType as DocType)) {
            p.outro(brand.error(`Unknown --type '${options.type}'. Use: ${DOC_TYPES.join(", ")}`));
            return;
          }
          docType = rawType as DocType;
        }

        if (!docType) {
          docType = (await guardPrompt(
            p.select({
              message: "Select document type to read:",
              options: [
                { label: " README (Repository Overview)", value: "README" },
                { label: " ARCHITECTURE (Architecture & Data Flow)", value: "ARCHITECTURE" },
                { label: " CODE_DOC (Individual Source File Doc)", value: "CODE_DOC" },
              ],
            }),
            "Cancelled.",
          )) as DocType;
        }

        let filePath = options?.path;
        if (docType === "CODE_DOC" && !filePath) {
          const filePrompt = await guardPrompt(
            p.text({
              message: "Enter source file path for code doc:",
              placeholder: "src/server/core/db.ts",
              validate: (val) => (!val?.trim() ? "Path cannot be empty" : undefined),
            }),
            "Cancelled.",
          );
          filePath = filePrompt.trim();
        }

        const result = await withTaskSpinner(
          {
            start: `Loading ${docType} for ${repoContext.target}...`,
            stop: "Document loaded!",
          },
          () =>
            docsService.getDocumentContent(repoContext.repo.id, docType, filePath, options?.aid),
        );

        const content = result.raw;

        if (!content) {
          const pathSuffix = filePath ? ` (${filePath})` : "";
          p.outro(
            brand.warning(
              `No content generated for ${docType}${pathSuffix}.\nRun 'dxnx analyze start ${repoContext.target}' first.`,
            ),
          );
          return;
        }

        if (options?.output) {
          const outPath = writeLocalFile(options.output, content);
          p.outro(brand.success(` Document saved to: ${brand.highlight(outPath)}`));
          return;
        }

        console.log(
          renderBlock(
            `[${docType}] ${repoContext.target}${filePath ? ` - ${filePath}` : ""}`,
            content,
          ),
        );
      },
    );

  docs
    .command("generate <filePath>")
    .alias("file")
    .description("Generate AI documentation for a specific file")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .option("-b, --branch <branch>", "Git branch name")
    .option("-l, --language <lang>", "Documentation language", "English")
    .option("-o, --output <file>", "Save generated markdown to file")
    .action(
      async (
        filePath: string,
        options: { branch?: string; language?: string; output?: string; repo?: string },
      ) => {
        p.intro(brand.logo(" ️ Generate Code Documentation "));

        const repoContext = await resolveRepository(options.repo);
        if (!repoContext) {
          return;
        }

        const fileContent = await readFileOrPrompt(filePath);
        if (!fileContent) {
          return;
        }

        const branch = options.branch ?? getCurrentGitBranch();

        const result = await withTaskSpinner(
          {
            start: `Generating documentation for ${pc.cyan(filePath)} (${options.language ?? "English"})...`,
            stop: "Documentation generated successfully!",
          },
          () =>
            docsService.documentFile({
              branch,
              content: fileContent,
              language: options.language ?? "English",
              path: filePath,
              repoId: repoContext.repo.id,
            }),
        );

        const markdown =
          typeof result === "string"
            ? result
            : typeof result === "object" &&
                result !== null &&
                "content" in result &&
                typeof result.content === "string"
              ? result.content
              : JSON.stringify(result, null, 2);

        if (options.output) {
          const outPath = writeLocalFile(options.output, markdown);
          p.outro(brand.success(` Generated doc saved to ${brand.highlight(outPath)}`));
          return;
        }

        console.log(renderBlock(`Documentation: ${filePath}`, markdown));
        p.outro(brand.success("Documentation ready!"));
      },
    );

  docs
    .command("pin <filePath>")
    .description(
      "Pin recent single-file audit report directly into permanent repository documentation",
    )
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .action(async (filePath: string, options: { repo?: string }) => {
      p.intro(brand.logo("  Pin Audit to Documentation "));

      const repoContext = await resolveRepository(options.repo);
      if (!repoContext) {
        return;
      }

      const doc = await withTaskSpinner(
        {
          start: `Pinning audit of ${pc.cyan(filePath)} to repository documentation...`,
          stop: "Audit pinned successfully!",
        },
        () => docsService.pinAuditToDocs(repoContext.repo.id, filePath),
      );

      p.note(
        `Document ID:  ${brand.highlight(String(doc.id))}\n` +
          `Type:         ${brand.info(doc.type)}\n` +
          `Target Path:  ${pc.cyan(doc.path ?? filePath)}\n` +
          `Version:      ${brand.muted(doc.version)}`,
        "Documentation Created",
      );

      p.outro(brand.success(" Single-file audit is now permanently recorded in docs!"));
    });

  docs
    .command("export [target]")
    .description("Export all generated documentation for repository into a local folder")
    .option("-d, --dir <directory>", "Local directory path to save docs", "./docs/doxynix")
    .action(async (target?: string, options?: { dir?: string }) => {
      p.intro(brand.logo("  Export Project Documentation "));

      const repoContext = await resolveRepository(target);
      if (!repoContext) {
        return;
      }

      const docsList = await withTaskSpinner(
        `Scanning available docs for ${repoContext.target}...`,
        () => docsService.getAvailableDocs(repoContext.repo.id),
      );
      const items: DocListItem[] = Array.isArray(docsList) ? docsList : [];

      if (items.length === 0) {
        p.outro(brand.warning(`No documentation found to export for ${repoContext.target}.`));
        return;
      }

      const baseDir = path.resolve(process.cwd(), options?.dir ?? "./docs/doxynix");

      let exportedCount = 0;
      const failed: string[] = [];

      await withTaskSpinner(
        `Downloading ${items.length} documentation files...`,
        async (update) => {
          for (const doc of items) {
            const type: DocType = doc.type;
            const filename =
              type === "README"
                ? "README.md"
                : type === "ARCHITECTURE"
                  ? "ARCHITECTURE.md"
                  : `code/${doc.path ? doc.path.replaceAll(/[\\/]/g, "_") : doc.id}.md`;

            update(`Saving ${filename}...`);

            try {
              const result = await docsService.getDocumentContent(
                repoContext.repo.id,
                type,
                doc.path ?? undefined,
              );
              const content = result.raw;

              if (content) {
                const fullFilePath = path.join(baseDir, filename);
                writeLocalFile(fullFilePath, content);
                exportedCount++;
              } else {
                failed.push(`${type}${doc.path ? ` (${doc.path})` : ""}: empty content`);
              }
            } catch (docError) {
              failed.push(
                `${type}${doc.path ? ` (${doc.path})` : ""}: ${
                  docError instanceof Error ? docError.message : "unknown error"
                }`,
              );
            }
          }
        },
      );

      if (failed.length > 0) {
        p.log.warn(brand.warning(`Skipped ${failed.length} document(s):\n${failed.join("\n")}`));
      }

      p.outro(
        brand.success(
          ` Successfully exported ${exportedCount} documentation files to ${brand.highlight(baseDir)}`,
        ),
      );
    });
}
