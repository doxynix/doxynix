import * as p from "@clack/prompts";
import type { Command } from "commander";

import { trpc } from "@/core/client";
import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";

import { renderKeysTable } from "./keys.formatter";

export function registerKeysCommand(program: Command) {
  const keys = program.command("keys").description("Manage Doxynix platform API keys");

  keys
    .command("list", { isDefault: true })
    .description("List all active (or archived) API access keys")
    .option("-a, --archived", "Include revoked/archived keys", false)
    .option("--json", "Output in JSON format")
    .action(async (options: { archived?: boolean; json?: boolean }) => {
      try {
        const s = p.spinner();
        if (!options.json) {
          s.start("Loading API keys...");
        }

        const data = await trpc.apikey.list.query({});
        if (!options.json) {
          s.stop("Keys retrieved");
        }

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
          validate(value) {
            if (!value || value.trim().length === 0) {
              return "Name is required";
            }
            if (value.length > 50) {
              return "Cannot exceed 50 characters";
            }
            return undefined;
          },
        });

        if (p.isCancel(name)) {
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

        const s = p.spinner();
        s.start("Generating secret key...");
        const result = await trpc.apikey.create.mutate({
          description:
            typeof description === "string" && description.trim().length > 0
              ? description.trim()
              : undefined,
          name: name.trim(),
        });
        s.stop("Key generated successfully!");

        p.note(
          `${brand.success(result.key)}\n\n` +
            brand.warning(
              "⚠️  Copy this key now. For security reasons, it will never be displayed again!",
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
    .description("Revoke (deactivate) an API key")
    .action(async (id?: string) => {
      try {
        p.intro(brand.warning(" 🗑️ Revoke API Key "));

        let keyId = id;

        if (!keyId) {
          const data = await trpc.apikey.list.query({});
          if (data.active.length === 0) {
            p.outro(brand.muted("No active keys available to revoke."));
            return;
          }

          const selection = await p.select({
            message: "Select the key to revoke:",
            options: data.active.map((k) => ({
              label: `${k.name} (${k.prefix}••••)`,
              value: k.id,
            })),
          });

          if (p.isCancel(selection)) {
            p.cancel("Cancelled.");
            return;
          }

          if (typeof selection === "string") {
            keyId = selection;
          }
        }

        if (!keyId) {
          return;
        }

        const isConfirmed = await p.confirm({
          message: `Are you sure you want to revoke key ${brand.highlight(keyId)}?`,
        });

        if (!isConfirmed || p.isCancel(isConfirmed)) {
          p.outro(brand.muted("Revocation cancelled."));
          return;
        }

        const s = p.spinner();
        s.start("Revoking key...");
        const res = await trpc.apikey.revoke.mutate({ id: keyId });
        s.stop("Key revoked successfully!");

        p.outro(brand.success(`✅ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
