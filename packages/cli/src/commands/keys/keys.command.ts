import * as p from "@clack/prompts";
import { CreateApiKeySchema } from "@doxynix/shared";
import type { Command } from "commander";

import { confirmOrAbort, guardPrompt, resolveEntityOrPick } from "@/core/prompts";
import { validateField } from "@/core/validation";

import { brand } from "@/ui/colors";
import { renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
import { withTaskSpinner } from "@/ui/spinner";

import { renderKeysTable } from "./keys.formatter";
import { keysService } from "./keys.service";
import type { ApiKeyItem } from "./keys.types";

async function resolveKeyId(keyIdArg?: string): Promise<string | null> {
  return resolveEntityOrPick({
    emptyMessage: "No active API keys found.",
    fetchItems: async () => {
      const result = await withTaskSpinner("Loading API keys...", () => keysService.list());
      return result.active;
    },
    getLabel: (key: ApiKeyItem) => `${key.name} (${key.prefix}••••) [${key.id.slice(0, 8)}]`,
    idArg: keyIdArg,
    matcher: (k: ApiKeyItem, query) =>
      k.id.toLowerCase().startsWith(query) || k.name.toLowerCase() === query,
    notFoundMessage: (target) => `No active API key found matching: '${target}'`,
    selectMessage: "Select an API key:",
  });
}

export function registerKeysCommand(program: Command) {
  const keys = program.command("keys").description("Manage Doxynix platform API keys");

  keys
    .command("list", { isDefault: true })
    .description("List all active (or archived) API access keys")
    .option("-a, --archived", "Include revoked/archived keys", false)
    .option("--json", "Output in JSON format")
    .action(async (options: { archived?: boolean; json?: boolean }) => {
      const result = await withTaskSpinner(
        {
          silent: options.json,
          start: "Loading API keys...",
          stop: "Keys retrieved",
        },
        () => keysService.list(),
      );

      if (output.json(result, options.json)) {
        return;
      }

      const keysToShow = options.archived ? [...result.active, ...result.archived] : result.active;

      if (keysToShow.length === 0) {
        p.outro(
          brand.muted("No active API keys found.\n") +
            brand.muted("Generate a new key with: ") +
            brand.highlight("dxnx keys create"),
        );
        return;
      }

      console.log(renderSection(brand.logo("Platform API Keys:"), renderKeysTable(keysToShow)));
      p.outro(
        brand.muted(`Active keys: ${result.active.length}, Archived: ${result.archived.length}`),
      );
    });

  keys
    .command("create")
    .description("Generate a new platform API key")
    .option("-n, --name <name>", "Key identifier name")
    .option("-d, --description <desc>", "Key description")
    .action(async (options: { description?: string; name?: string }) => {
      p.intro(brand.logo("Generate API Key"));

      let name = options.name?.trim();
      if (!name) {
        name = await guardPrompt(
          p.text({
            message: "Enter key name/identifier:",
            placeholder: "github-actions-ci",
            validate: validateField(CreateApiKeySchema.shape.name),
          }),
          "Creation cancelled.",
        );
      }

      const descInput = await guardPrompt(
        p.text({
          message: "Description (optional):",
          placeholder: "Key for automated CI/CD runners",
        }),
        "Creation cancelled.",
      );

      const description = descInput.trim().length > 0 ? descInput.trim() : undefined;

      const result = await withTaskSpinner(
        {
          start: "Generating secret key...",
          stop: "Key generated successfully!",
        },
        () =>
          keysService.create({
            description,
            name,
          }),
      );

      p.note(
        `${brand.success(result.key)}\n\n` +
          brand.warning(
            "Copy this key now. For security reasons, it will never be displayed again!",
          ),
        "Your Secret API Key",
      );

      p.outro(brand.success("Ready to use!"));
    });

  keys
    .command("revoke [id]")
    .description("Revoke an API key (supports Short-ID prefix and interactive pick)")
    .action(async (id?: string) => {
      p.intro(brand.warning("Revoke API Key"));

      const keyId = await resolveKeyId(id);
      if (!keyId) {
        return;
      }

      const confirmed = await confirmOrAbort({
        cancelMessage: "Revocation cancelled.",
        message: `Are you sure you want to revoke key ${brand.highlight(keyId.slice(0, 8))}?`,
      });

      if (!confirmed) {
        return;
      }

      const result = await withTaskSpinner(
        {
          start: "Revoking key...",
          stop: "Key revoked successfully!",
        },
        () => keysService.revoke(keyId),
      );

      p.outro(brand.success(result.message));
    });

  keys
    .command("update [id]")
    .description("Update key metadata (supports Short-ID prefix and interactive pick)")
    .option("-n, --name <name>", "New name for the key")
    .option("-d, --description <desc>", "New description for the key")
    .action(async (id?: string, options?: { description?: string; name?: string }) => {
      p.intro(brand.logo("Update API Key"));

      const keyId = await resolveKeyId(id);
      if (!keyId) {
        return;
      }

      const data = await keysService.list();
      const currentKey = data.active.find((k: ApiKeyItem) => k.id === keyId);
      if (!currentKey) {
        p.outro(brand.error("Key not found."));
        return;
      }

      let newName = options?.name;
      if (!newName) {
        const newNamePrompt = await guardPrompt(
          p.text({
            defaultValue: currentKey.name,
            message: "Enter updated key name:",
            placeholder: currentKey.name,
            validate: validateField(CreateApiKeySchema.shape.name),
          }),
          "Update cancelled.",
        );
        newName = newNamePrompt.trim();
      }

      let newDesc = options?.description;
      if (newDesc === undefined) {
        const descPrompt = await guardPrompt(
          p.text({
            defaultValue: currentKey.description ?? "",
            message: "Enter updated description (leave empty to clear):",
            placeholder: "e.g. CI runner for staging",
          }),
          "Update cancelled.",
        );
        const descInput = descPrompt.trim();
        newDesc = descInput.length > 0 ? descInput : "";
      }

      const result = await withTaskSpinner(
        {
          start: "Updating API key...",
          stop: "API key updated successfully!",
        },
        () =>
          keysService.update({
            description: newDesc,
            id: keyId,
            name: newName,
          }),
      );

      p.outro(brand.success(` ${result.message}`));
    });
}
