import * as p from "@clack/prompts";
import type { Command } from "commander";

import { guardPrompt } from "@/core/prompts";

import { brand } from "@/ui/colors";
import { output } from "@/ui/output";
import { withTaskSpinner } from "@/ui/spinner";

import { renderUserProfile } from "./auth.formatter";
import { authService } from "./auth.service";

export function registerAuthCommands(program: Command) {
  program
    .command("login")
    .description("Authenticate with Doxynix using an API Key")
    .option("-t, --token <token>", "API Key (for CI/CD and automation scripts)")
    .action(async (options: { token?: string }) => {
      p.intro(brand.logo("Doxynix Authentication"));

      let token = options.token?.trim();

      if (!token) {
        const input = await guardPrompt(
          p.password({
            message: "Paste your Doxynix API key:",
            validate: (val) =>
              !val || val.trim().length === 0 ? "Token cannot be empty" : undefined,
          }),
          "Authentication cancelled.",
        );
        token = input.trim();
      }

      authService.setSessionToken(token);

      let result;
      try {
        result = await withTaskSpinner(
          {
            start: "Verifying API Key credentials...",
            stop: "API Key verified successfully!",
          },
          () => authService.verifyCurrentUser(),
        );
        authService.saveToken(token);
      } finally {
        authService.setSessionToken(null);
      }

      p.note(
        `User:   ${brand.highlight(result.user.name ?? "Anonymous")}\n` +
          `Email:  ${brand.highlight(result.user.email ?? "Not specified")}\n` +
          `Role:   ${brand.info(result.user.role)}`,
        "Successfully Authenticated",
      );

      p.outro(brand.success("Token securely stored in ~/.config/dxnx/config.json (0o600)."));
    });

  program
    .command("logout")
    .description("Sign out and remove local credentials from this machine")
    .action(() => {
      p.intro(brand.logo("Sign Out"));

      const hasEnvToken = Boolean(process.env.DOXYNIX_API_KEY || process.env.DXNX_TOKEN);
      const token = authService.getToken();
      if (!token && !hasEnvToken) {
        p.outro(brand.muted("You are already signed out."));
        return;
      }

      authService.removeToken();

      if (hasEnvToken) {
        p.outro(
          brand.warning(
            "Local config cleared, but DOXYNIX_API_KEY or DXNX_TOKEN is still set in your environment variables.\n" +
              "Unset them in your shell to completely sign out.",
          ),
        );
        return;
      }

      p.outro(brand.success("Local token removed successfully. See you later!"));
    });

  program
    .command("me")
    .alias("whoami")
    .description("Display the currently authenticated user profile")
    .option("--json", "Output response in JSON format")
    .action(async (options: { json?: boolean }) => {
      const token = authService.getToken();
      if (!token) {
        if (output.json({ authenticated: false }, options.json)) {
          return;
        }
        p.outro(
          brand.warning("You are not authenticated.\n") +
            brand.muted("Run ") +
            brand.highlight("dxnx login") +
            brand.muted(" to sign in."),
        );
        return;
      }

      const result = await withTaskSpinner(
        {
          silent: options.json,
          start: "Fetching user profile...",
          stop: "Profile retrieved",
        },
        () => authService.verifyCurrentUser(),
      );

      if (output.json(result.user, options.json)) {
        return;
      }

      renderUserProfile(result.user);
    });
}
