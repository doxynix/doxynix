import { defineConfig } from "@eloqnt/cli";

export default defineConfig({
  lint: {
    overrides: [
      {
        keys: [
          "Auth.email_10_minutes",
          "Auth.email_click_to_complete",
          "Auth.email_confirm_sign_in",
          "Auth.email_fallback_instruction",
          "Auth.email_ignore_if_not_requested",
          "Auth.email_log_in_button",
          "Auth.email_login_request_sent",
          "Auth.email_preview_text",
        ],
        rules: { "orphan-message": "off" },
      },
    ],
    rules: {
      "duplicate-id": "warn",
      "inconsistent-args": "warn",
      "inconsistent-exact-plurals": "warn",
      "invalid-locale": "warn",
      "missing-other-case": "warn",
      "missing-translation": "warn",
      "orphan-message": "warn",
      "structure-mismatch": "warn",
      "superfluous-key": "warn",
      "undefined-key": "warn",
      "unreachable-plural-case": "warn",
    },
  },
  messages: {
    format: "json",
    locales: ["en", "de", "es", "fr", "pt-BR", "ru", "zh-CN", "it", "ja", "ko", "pl", "tr"],
    path: "./messages",
    sourceLocale: "en",
  },
  srcPath: "./src",
});
