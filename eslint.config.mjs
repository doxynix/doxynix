import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "next-env.d.ts",
      "src/generated/**",
      "vitest.config.ts",
      "eslint.config.mjs",
      "postcss.config.mjs",
      "next.config.mjs",
    ],
  },

  ...nextVitals,
  ...nextTs,

  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "@typescript-eslint": tsPlugin,
      "unused-imports": unusedImportsPlugin,
      prettier: prettierPlugin,
    },

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        project: ["./tsconfig.json"],
      },
    },

    settings: {
      react: {
        version: "detect",
      },
    },

    rules: {
      "prettier/prettier": "warn",

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      "unused-imports/no-unused-imports": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/strict-boolean-expressions": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
    },
  },

  {
    files: [
      "src/shared/ui/**/*.{ts,tsx}",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/tests/**/*.{ts,tsx}",
    ],
    rules: {
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  prettierConfig,
]);
