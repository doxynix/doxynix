import { defineConfig } from "@eloqnt/cli";

export default defineConfig({
  lint: {
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
