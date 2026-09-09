import * as p from "@clack/prompts";
import { UpdateProfileSchema } from "@doxynix/shared";
import { type Command } from "commander";

import { removeToken } from "@/core/config";
import { handleCliError } from "@/core/errors";
import { validateField } from "@/core/validation";

import { brand } from "@/ui/colors";
import { withTaskSpinner } from "@/ui/spinner";

import { renderLinkedAccountsTable, renderSessionsTable } from "./profile.formatter";
import { profileService } from "./profile.service";

export function registerProfileCommand(program: Command) {
  const profile = program
    .command("profile")
    .description("Manage your Doxynix user profile, active sessions, and security");

  profile.action(async () => {
    try {
      const res = await withTaskSpinner(
        { start: "Loading user profile...", stop: "Profile loaded" },
        () => profileService.getProfile(),
      );

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

  profile
    .command("update")
    .description("Interactively update your profile credentials")
    .action(async () => {
      try {
        p.intro(brand.logo(" ✏️ Edit Profile "));
        const current = await profileService.getProfile();

        const newName = await p.text({
          message: "Enter your updated profile name:",
          placeholder: current.user.name ?? "Jane Doe",
          validate: validateField(UpdateProfileSchema.shape.name),
        });

        if (p.isCancel(newName) || !newName) {
          p.cancel("Profile update cancelled.");
          return;
        }

        await withTaskSpinner(
          { start: "Saving changes...", stop: "Profile updated successfully!" },
          () => profileService.updateProfile(newName.trim()),
        );

        p.outro(brand.success(`✅ Profile name updated to: ${brand.highlight(newName.trim())}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  profile
    .command("sessions")
    .description("List active login sessions across devices and browsers")
    .option("--json", "Output sessions in JSON format")
    .action(async (options: { json?: boolean }) => {
      try {
        const sessions = await withTaskSpinner(
          {
            silent: options.json,
            start: "Retrieving active sessions...",
            stop: "Sessions loaded",
          },
          () => profileService.getActiveSessions(),
        );

        if (options.json) {
          const safeSessions = sessions.map(({ token: _token, ...sess }) => sess);
          console.log(JSON.stringify(safeSessions, null, 2));
          return;
        }

        if (sessions.length === 0) {
          p.outro(brand.muted("No active sessions recorded."));
          return;
        }

        console.log(`\n${brand.logo(" 💻 Active User Sessions:\n")}`);
        console.log(renderSessionsTable(sessions));
        console.log("\n");
        p.outro(brand.muted(`Active devices: ${sessions.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  profile
    .command("accounts")
    .description("List connected OAuth providers (GitHub, Google, Yandex)")
    .option("--json", "Output linked accounts in JSON format")
    .action(async (options: { json?: boolean }) => {
      try {
        const res = await withTaskSpinner(
          {
            silent: options.json,
            start: "Fetching linked authentication providers...",
            stop: "Accounts loaded",
          },
          () => profileService.getLinkedAccounts(),
        );

        if (options.json) {
          console.log(JSON.stringify(res, null, 2));
          return;
        }

        if (!res.accounts || res.accounts.length === 0) {
          p.outro(brand.muted("No external OAuth providers linked."));
          return;
        }

        console.log(`\n${brand.logo(" 🔗 Linked Authentication Providers:\n")}`);
        console.log(renderLinkedAccountsTable(res.accounts));
        console.log("\n");
        p.outro(brand.muted("Disconnect with: dxnx profile disconnect <provider>"));
      } catch (error) {
        handleCliError(error);
      }
    });

  profile
    .command("disconnect <provider>")
    .description("Disconnect an OAuth provider (github, google, yandex)")
    .action(async (provider: string) => {
      try {
        const validProviders = ["github", "google", "yandex"] as const;
        const normalized = provider.toLowerCase();

        if (!validProviders.includes(normalized as (typeof validProviders)[number])) {
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

        await withTaskSpinner(
          { start: `Disconnecting ${normalized}...`, stop: "Disconnected!" },
          () =>
            profileService.disconnectAccount({
              provider: normalized as (typeof validProviders)[number],
            }),
        );

        p.outro(
          brand.success(`✔ Provider ${brand.highlight(normalized)} disconnected successfully.`),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  profile
    .command("remove-avatar")
    .description("Remove custom profile picture and reset to default avatar")
    .action(async () => {
      try {
        const res = await withTaskSpinner(
          { start: "Deleting profile avatar...", stop: "Avatar removed!" },
          () => profileService.removeAvatar(),
        );
        p.outro(brand.success(`✔ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

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

        const res = await withTaskSpinner(
          { start: "Deleting account...", stop: "Account deleted." },
          () => profileService.deleteAccount(),
        );

        removeToken();
        p.outro(brand.error(`👋 ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
