import * as p from "@clack/prompts";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";

import { authService } from "./auth.service";

export function registerAuthCommands(program: Command) {
  // 1. dxnx login
  program
    .command("login")
    .description("Authenticate with Doxynix using an API Key")
    .option("-t, --token <token>", "API Key (for CI/CD and automation scripts)")
    .action(async (options: { token?: string }) => {
      try {
        p.intro(brand.logo(" 🔑 Doxynix Authentication "));

        let token = options.token;

        if (!token) {
          const input = await p.password({
            message: "Paste your Doxynix API key:",
            validate: (val) => {
              if (!val || val.trim().length === 0) {
                return "Token cannot be empty";
              }
              return undefined;
            },
          });

          if (p.isCancel(input)) {
            p.cancel("Authentication cancelled.");
            process.exit(0);
          }

          token = input.trim();
        }

        const s = p.spinner();
        s.start("Verifying API Key credentials...");

        authService.saveToken(token);

        const res = await authService.verifyCurrentUser();
        s.stop("API Key verified successfully!");

        p.note(
          `User:   ${brand.highlight(res.user.name ?? "Anonymous")}\n` +
            `Email:  ${brand.highlight(res.user.email ?? "Not specified")}\n` +
            `Role:   ${brand.info(res.user.role)}`,
          "Successfully Authenticated",
        );

        p.outro(brand.success("✨ Token securely stored in ~/.dxnxconfig (0o600)."));
      } catch (error) {
        handleCliError(error);
      }
    });

  // 2. dxnx logout
  program
    .command("logout")
    .description("Sign out and remove local credentials from this machine")
    .action(() => {
      p.intro(brand.logo(" 🚪 Sign Out "));

      const token = authService.getToken();
      if (!token) {
        p.outro(brand.muted("You are already signed out."));
        return;
      }

      authService.removeToken();
      p.outro(brand.success("✅ Local token removed successfully. See you later!"));
    });

  // 3. dxnx me
  program
    .command("me")
    .alias("whoami")
    .description("Display the currently authenticated user profile")
    .option("--json", "Output response in JSON format")
    .action(async (options: { json?: boolean }) => {
      try {
        const token = authService.getToken();
        if (!token) {
          if (options.json) {
            console.log(JSON.stringify({ authenticated: false }));
            return;
          }
          p.outro(
            brand.warning("⚠️ You are not authenticated.\n") +
              brand.muted("Run ") +
              brand.highlight("dxnx login") +
              brand.muted(" to sign in."),
          );
          return;
        }

        const s = p.spinner();
        if (!options.json) {
          s.start("Fetching user profile...");
        }

        const res = await authService.verifyCurrentUser();
        if (!options.json) {
          s.stop("Profile retrieved");
        }

        if (options.json) {
          console.log(JSON.stringify(res.user, null, 2));
          return;
        }

        console.log(`\n  Name:   ${brand.highlight(res.user.name ?? "Not set")}`);
        console.log(`  Email:  ${brand.highlight(res.user.email ?? "Not set")}`);
        console.log(`  Role:   ${brand.info(res.user.role)}`);
        console.log(`  ID:     ${brand.muted(res.user.id)}\n`);
      } catch (error) {
        handleCliError(error);
      }
    });
}
