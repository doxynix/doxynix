import * as p from "@clack/prompts";
import { UpdateProfileSchema } from "@doxynix/shared";
import type { Command } from "commander";

import { getToken, removeToken } from "@/core/config";
import { confirmOrAbort, guardPrompt } from "@/core/prompts";
import { validateField } from "@/core/validation";

import { brand } from "@/ui/colors";
import { formatDate } from "@/ui/formatters";
import { renderCard, renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
import { withTaskSpinner } from "@/ui/spinner";

import { renderLinkedAccountsTable, renderSessionsTable } from "./profile.formatter";
import { profileService } from "./profile.service";

export function registerProfileCommand(program: Command) {
  const profile = program
    .command("profile")
    .description("Manage your Doxynix user profile, active sessions, and security");

  profile.action(async () => {
    if (!getToken()) {
      p.outro(
        brand.warning("You are not authenticated.\n") +
          brand.muted("Run ") +
          brand.highlight("dxnx login") +
          brand.muted(" to sign in."),
      );
      return;
    }
    const result = await withTaskSpinner(
      { start: "Loading user profile...", stop: "Profile loaded" },
      () => profileService.getProfile(),
    );

    console.log(
      renderCard("Current Profile", [
        ["Name", brand.highlight(result.user.name ?? "Not set")],
        ["Email", brand.highlight(result.user.email ?? "Not set")],
        ["Created", brand.muted(formatDate(result.user.createdAt))],
        ["ID (UUID)", brand.muted(result.user.id)],
      ]),
    );
  });

  profile
    .command("update")
    .description("Interactively update your profile credentials")
    .action(async () => {
      p.intro(brand.logo("Edit Profile"));
      const current = await profileService.getProfile();

      const namePrompt = await guardPrompt(
        p.text({
          message: "Enter your updated profile name:",
          placeholder: current.user.name ?? "Jane Doe",
          validate: validateField(UpdateProfileSchema.shape.name),
        }),
        "Profile update cancelled.",
      );
      const newName = namePrompt.trim();

      await withTaskSpinner(
        { start: "Saving changes...", stop: "Profile updated successfully!" },
        () => profileService.updateProfile(newName.trim()),
      );

      p.outro(brand.success(` Profile name updated to: ${brand.highlight(newName.trim())}`));
    });

  profile
    .command("sessions")
    .description("List active login sessions across devices and browsers")
    .option("--json", "Output sessions in JSON format")
    .action(async (options: { json?: boolean }) => {
      const sessions = await withTaskSpinner(
        {
          silent: options.json,
          start: "Retrieving active sessions...",
          stop: "Sessions loaded",
        },
        () => profileService.getActiveSessions(),
      );

      const safeSessions = sessions.map(({ token: _token, ...sess }) => sess);

      if (output.json(safeSessions, options.json)) {
        return;
      }

      if (sessions.length === 0) {
        p.outro(brand.muted("No active sessions recorded."));
        return;
      }

      console.log(
        renderSection(brand.logo("  Active User Sessions:"), renderSessionsTable(sessions)),
      );
      p.outro(brand.muted(`Active devices: ${sessions.length}`));
    });

  profile
    .command("accounts")
    .description("List connected OAuth providers (GitHub, Google, Yandex)")
    .option("--json", "Output linked accounts in JSON format")
    .action(async (options: { json?: boolean }) => {
      const result = await withTaskSpinner(
        {
          silent: options.json,
          start: "Fetching linked authentication providers...",
          stop: "Accounts loaded",
        },
        () => profileService.getLinkedAccounts(),
      );

      if (output.json(result, options.json)) {
        return;
      }

      if (!result.accounts || result.accounts.length === 0) {
        p.outro(brand.muted("No external OAuth providers linked."));
        return;
      }

      console.log(
        renderSection(
          brand.logo("Linked Authentication Providers:"),
          renderLinkedAccountsTable(result.accounts),
        ),
      );
      p.outro(brand.muted("Disconnect with: dxnx profile disconnect <provider>"));
    });

  profile
    .command("disconnect <provider>")
    .description("Disconnect an OAuth provider (github, google, yandex)")
    .action(async (provider: string) => {
      const validProviders = ["github", "google", "yandex"] as const;
      const normalized = provider.toLowerCase();

      if (!validProviders.includes(normalized as (typeof validProviders)[number])) {
        p.outro(
          brand.error(`Invalid provider: '${provider}'. Valid options: github, google, yandex`),
        );
        return;
      }

      const confirmed = await confirmOrAbort(
        `Are you sure you want to disconnect ${brand.highlight(normalized.toUpperCase())}?`,
      );

      if (!confirmed) {
        return;
      }

      await withTaskSpinner(
        { start: `Disconnecting ${normalized}...`, stop: "Disconnected!" },
        () =>
          profileService.disconnectAccount({
            provider: normalized as (typeof validProviders)[number],
          }),
      );

      p.outro(brand.success(`Provider ${brand.highlight(normalized)} disconnected successfully.`));
    });

  profile
    .command("remove-avatar")
    .description("Remove custom profile picture and reset to default avatar")
    .action(async () => {
      const result = await withTaskSpinner(
        { start: "Deleting profile avatar...", stop: "Avatar removed!" },
        () => profileService.removeAvatar(),
      );
      p.outro(brand.success(` ${result.message}`));
    });

  profile
    .command("delete")
    .description("Permanently delete your Doxynix account and all associated data")
    .action(async () => {
      p.intro(brand.error("Danger Zone: Delete Account"));

      const confirmed = await confirmOrAbort({
        active: "Yes, delete everything",
        cancelMessage: "Account deletion cancelled.",
        danger: true,
        inactive: "Cancel",
        message: "Are you sure you want to PERMANENTLY delete your account and all repositories?",
      });

      if (!confirmed) {
        return;
      }

      const result = await withTaskSpinner(
        { start: "Deleting account...", stop: "Account deleted." },
        () => profileService.deleteAccount(),
      );

      removeToken();
      p.outro(brand.error(` ${result.message}`));
    });
}
