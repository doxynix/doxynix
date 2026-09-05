// packages/cli/src/commands/profile/profile.command.ts
import * as p from "@clack/prompts";
import type { Command } from "commander";

import { removeToken } from "@/core/config";
import { handleCliError } from "@/core/errors";

import { brand, pc } from "@/ui/colors";
import { createTable } from "@/ui/table";

import { profileService } from "./profile.service";

export function registerProfileCommand(program: Command) {
  const profile = program
    .command("profile")
    .description("Manage your Doxynix user profile and security");

  // dxnx profile (default)
  profile.action(async () => {
    try {
      const s = p.spinner();
      s.start("Loading user profile...");
      const res = await profileService.getProfile();
      s.stop("Profile loaded");

      console.log(`\n  Name:       ${brand.highlight(res.user.name ?? "Not set")}`);
      console.log(`  Email:      ${brand.highlight(res.user.email ?? "Not set")}`);
      console.log(`  Role:       ${brand.info(res.user.role)}`);
      console.log(
        `  Created:    ${brand.muted(new Date(res.user.createdAt).toLocaleDateString())}`,
      );
      console.log(`  ID (UUID):  ${brand.muted(res.user.id)}\n`);
    } catch (error) {
      handleCliError(error);
    }
  });

  // dxnx profile update
  profile
    .command("update")
    .description("Interactively update your profile information")
    .action(async () => {
      try {
        p.intro(brand.logo(" ✏️ Edit Profile "));
        const current = await profileService.getProfile();

        const newName = await p.text({
          message: "Enter your updated profile name:",
          placeholder: current.user.name ?? "Jane Doe",
          validate(value) {
            if (!value || value.trim().length === 0) {
              return "Name cannot be empty";
            }
            if (value.length > 50) {
              return "Name cannot exceed 50 characters";
            }
            return undefined;
          },
        });

        if (p.isCancel(newName)) {
          p.cancel("Profile update cancelled.");
          return;
        }

        const s = p.spinner();
        s.start("Saving changes...");
        await profileService.updateProfile(newName.trim());
        s.stop("Profile updated successfully!");

        p.outro(brand.success(`✅ Profile name updated to: ${brand.highlight(newName.trim())}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx profile sessions
  profile
    .command("sessions")
    .description("List active login sessions across devices and browsers")
    .option("--json", "Output sessions in JSON format")
    .action(async (options: { json?: boolean }) => {
      try {
        const s = p.spinner();
        if (!options.json) {
          s.start("Retrieving active sessions...");
        }
        const sessions = await profileService.getActiveSessions();
        if (!options.json) {
          s.stop("Sessions loaded");
        }

        if (options.json) {
          console.log(JSON.stringify(sessions, null, 2));
          return;
        }

        if (sessions.length === 0) {
          p.outro(brand.muted("No active sessions recorded."));
          return;
        }

        const table = createTable(["Client / User Agent", "IP Address", "Created At"]);
        for (const sess of sessions) {
          table.push([
            brand.highlight(sess.userAgent || "Unknown Device"),
            brand.info(sess.ipAddress || "—"),
            brand.muted(new Date(sess.createdAt).toLocaleString()),
          ]);
        }

        console.log(`\n${brand.logo(" 💻 Active User Sessions:\n")}`);
        console.log(table.toString());
        console.log("\n");
        p.outro(brand.muted(`Active devices: ${sessions.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx profile accounts
  profile
    .command("accounts")
    .description("List connected OAuth providers (GitHub, Google, Yandex)")
    .option("--json", "Output linked accounts in JSON format")
    .action(async (options: { json?: boolean }) => {
      try {
        const s = p.spinner();
        if (!options.json) {
          s.start("Fetching linked authentication providers...");
        }
        const res = await profileService.getLinkedAccounts();
        if (!options.json) {
          s.stop("Accounts loaded");
        }

        if (options.json) {
          console.log(JSON.stringify(res, null, 2));
          return;
        }

        if (!res.accounts || res.accounts.length === 0) {
          p.outro(brand.muted("No external OAuth providers linked."));
          return;
        }

        const table = createTable(["Provider", "Account Name", "Email"]);
        for (const acc of res.accounts) {
          table.push([
            pc.cyan(pc.bold(acc.provider.toUpperCase())),
            brand.highlight(acc.name ?? "—"),
            brand.muted(acc.email ?? "—"),
          ]);
        }

        console.log(`\n${brand.logo(" 🔗 Linked Authentication Providers:\n")}`);
        console.log(table.toString());
        console.log("\n");
        p.outro(brand.muted("Disconnect with: dxnx profile disconnect <provider>"));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx profile disconnect <provider>
  profile
    .command("disconnect <provider>")
    .description("Disconnect an OAuth provider (github, google, yandex)")
    .action(async (provider: string) => {
      try {
        const validProviders = ["github", "google", "yandex"];
        const normalized = provider.toLowerCase() as "github" | "google" | "yandex";

        if (!validProviders.includes(normalized)) {
          p.outro(
            brand.error(`Invalid provider: '${provider}'. Valid options: github, google, yandex`),
          );
          return;
        }

        const isConfirmed = await p.confirm({
          message: `Are you sure you want to disconnect ${brand.highlight(normalized.toUpperCase())}?`,
        });

        if (!isConfirmed || p.isCancel(isConfirmed)) {
          p.outro(brand.muted("Action cancelled."));
          return;
        }

        const s = p.spinner();
        s.start(`Disconnecting ${normalized}...`);
        await profileService.disconnectAccount(normalized);
        s.stop("Disconnected!");

        p.outro(
          brand.success(`✔ Provider ${brand.highlight(normalized)} disconnected successfully.`),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx profile remove-avatar
  profile
    .command("remove-avatar")
    .description("Remove custom profile picture and reset to default avatar")
    .action(async () => {
      try {
        const s = p.spinner();
        s.start("Deleting profile avatar...");
        const res = await profileService.removeAvatar();
        s.stop("Avatar removed!");
        p.outro(brand.success(`✔ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx profile delete
  profile
    .command("delete")
    .description("Permanently delete your Doxynix account and all associated data")
    .action(async () => {
      try {
        p.intro(brand.error(" ⚠️ Danger Zone: Delete Account "));

        const isConfirmed = await p.confirm({
          active: "Yes, delete everything",
          inactive: "Cancel",
          message: brand.error(
            "Are you sure you want to PERMANENTLY delete your account and all repositories?",
          ),
        });

        if (!isConfirmed || p.isCancel(isConfirmed)) {
          p.outro(brand.muted("Account deletion cancelled."));
          return;
        }

        const s = p.spinner();
        s.start("Deleting account...");
        const res = await profileService.deleteAccount();
        s.stop("Account deleted.");

        removeToken();
        p.outro(brand.error(`👋 ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
