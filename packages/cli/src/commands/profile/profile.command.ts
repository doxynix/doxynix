import * as p from "@clack/prompts";
import type { Command } from "commander";

import { removeToken } from "@/core/config";
import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";

import { profileService } from "./profile.service";

export function registerProfileCommand(program: Command) {
  const profile = program.command("profile").description("Manage your Doxynix user profile");

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
