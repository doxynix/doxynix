import * as p from "@clack/prompts";
import { CreateApiKeySchema } from "@doxynix/shared";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";
import { validateField } from "@/core/validation";

import { brand } from "@/ui/colors";
import { withTaskSpinner } from "@/ui/spinner";

import { renderKeysTable } from "./keys.formatter";
import { keysService } from "./keys.service";
import type { ApiKeyItem } from "./keys.types";

async function resolveKeyId(keyIdArg?: string): Promise<string | null> {
  const data = await withTaskSpinner("Loading API keys...", () => keysService.list());
  if (data.active.length === 0) {
    p.outro(brand.muted("No active API keys found."));
    return null;
  }

  const target = keyIdArg?.trim();
  if (target) {
    const prefix = target.toLowerCase();
    const match = data.active.find(
      (k: ApiKeyItem) => k.id.toLowerCase().startsWith(prefix) || k.name.toLowerCase() === prefix,
    );
    if (!match) {
      p.outro(brand.error(`No active API key found matching: '${target}'`));
      return null;
    }
    return match.id;
  }

  const selection = await p.select({
    message: "Select an API key:",
    options: data.active.map((key: ApiKeyItem) => ({
      label: `${key.name} (${key.prefix}••••) [${key.id.slice(0, 8)}]`,
      value: key.id,
    })),
  });

  if (p.isCancel(selection) || typeof selection !== "string") {
    p.cancel("Operation cancelled.");
    return null;
  }

  return selection;
}

export function registerKeysCommand(program: Command) {
  const keys = program.command("keys").description("Manage Doxynix platform API keys");

  keys
    .command("list", { isDefault: true })
    .description("List all active (or archived) API access keys")
    .option("-a, --archived", "Include revoked/archived keys", false)
    .option("--json", "Output in JSON format")
    .action(async (options: { archived?: boolean; json?: boolean }) => {
      try {
        const data = await withTaskSpinner(
          {
            silent: options.json,
            start: "Loading API keys...",
            stop: "Keys retrieved",
          },
          () => keysService.list(),
        );

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        const keysToShow = options.archived ? [...data.active, ...data.archived] : data.active;

        if (keysToShow.length === 0) {
          p.outro(
            brand.muted("No active API keys found.\n") +
              brand.muted("Generate a new key with: ") +
              brand.highlight("dxnx keys create"),
          );
          return;
        }

        console.log(`\n${renderKeysTable(keysToShow)}\n`);
        p.outro(
          brand.muted(`Active keys: ${data.active.length}, Archived: ${data.archived.length}`),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  keys
    .command("create")
    .description("Generate a new platform API key")
    .action(async () => {
      try {
        p.intro(brand.logo(" 🔑 Generate API Key "));

        const name = await p.text({
          message: "Enter key name/identifier:",
          placeholder: "github-actions-ci",
          validate: validateField(CreateApiKeySchema.shape.name),
        });

        if (p.isCancel(name) || !name) {
          p.cancel("Creation cancelled.");
          return;
        }

        const description = await p.text({
          message: "Description (optional):",
          placeholder: "Key for automated CI/CD runners",
        });

        if (p.isCancel(description)) {
          p.cancel("Creation cancelled.");
          return;
        }

        const result = await withTaskSpinner(
          {
            start: "Generating secret key...",
            stop: "Key generated successfully!",
          },
          () =>
            keysService.create({
              description:
                typeof description === "string" && description.trim().length > 0
                  ? description.trim()
                  : undefined,
              name: name.trim(),
            }),
        );

        p.note(
          `${brand.success(result.key)}\n\n` +
            brand.warning(
              "⚠️ Copy this key now. For security reasons, it will never be displayed again!",
            ),
          "Your Secret API Key",
        );

        p.outro(brand.success("Ready to use!"));
      } catch (error) {
        handleCliError(error);
      }
    });

  keys
    .command("revoke [id]")
    .description("Revoke an API key (supports Short-ID prefix and interactive pick)")
    .action(async (id?: string) => {
      try {
        p.intro(brand.warning(" 🗑️ Revoke API Key "));

        const keyId = await resolveKeyId(id);
        if (!keyId) {
          return;
        }

        const isConfirmed = await p.confirm({
          message: `Are you sure you want to revoke key ${brand.highlight(keyId.slice(0, 8))}?`,
        });

        if (!isConfirmed || p.isCancel(isConfirmed)) {
          p.outro(brand.muted("Revocation cancelled."));
          return;
        }

        const result = await withTaskSpinner(
          {
            start: "Revoking key...",
            stop: "Key revoked successfully!",
          },
          () => keysService.revoke(keyId),
        );

        p.outro(brand.success(`✅ ${result.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  keys
    .command("update [id]")
    .description("Update key metadata (supports Short-ID prefix and interactive pick)")
    .option("-n, --name <name>", "New name for the key")
    .option("-d, --description <desc>", "New description for the key")
    .action(async (id?: string, options?: { description?: string; name?: string }) => {
      try {
        p.intro(brand.logo(" ✏️ Update API Key "));

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
          const nameInput = await p.text({
            defaultValue: currentKey.name,
            message: "Enter updated key name:",
            placeholder: currentKey.name,
            validate: validateField(CreateApiKeySchema.shape.name),
          });

          if (p.isCancel(nameInput) || !nameInput) {
            p.cancel("Update cancelled.");
            return;
          }
          newName = nameInput.trim();
        }

        let newDesc = options?.description;
        if (newDesc === undefined) {
          const descInput = await p.text({
            defaultValue: currentKey.description ?? "",
            message: "Enter updated description (optional):",
            placeholder: "e.g. CI runner for staging",
          });

          if (p.isCancel(descInput)) {
            p.cancel("Update cancelled.");
            return;
          }
          newDesc =
            typeof descInput === "string" && descInput.trim().length > 0
              ? descInput.trim()
              : undefined;
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

        p.outro(brand.success(`✔ ${result.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
