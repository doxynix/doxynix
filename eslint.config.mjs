import tanstackQuery from "@tanstack/eslint-plugin-query";
import tsParser from "@typescript-eslint/parser";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettierPlugin from "eslint-plugin-prettier";
import reactPlugin from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import unicorn from "eslint-plugin-unicorn";
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
      "coverage/**",
      "report/**",
      ".trigger/**",
    ],
  },

  ...nextVitals,
  ...nextTs,

  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "unused-imports": unusedImportsPlugin,
      "react-compiler": reactCompiler,
      "@tanstack/query": tanstackQuery,
      boundaries: boundaries,
      prettier: prettierPlugin,
      unicorn,
    },

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },

    settings: {
      react: {
        version: "detect",
      },
      "boundaries/elements": [
        { type: "app", pattern: "src/app/*" },
        { type: "widgets", pattern: "src/widgets/*" },
        { type: "features", pattern: "src/features/*" },
        { type: "entities", pattern: "src/entities/*" },
        { type: "shared", pattern: "src/shared/*" },
      ],
    },

    rules: {
      "prettier/prettier": "warn",

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-compiler/react-compiler": "error",

      "@tanstack/query/exhaustive-deps": "error",
      "@tanstack/query/no-rest-destructuring": "warn",
      "@tanstack/query/stable-query-client": "error",

      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: ["shared", "generated"],
              disallow: ["app", "trigger", "server", "widgets", "features", "entities"],
              message: "Shared/Generated module must not import from upper layers",
            },
            {
              from: ["entities"],
              disallow: ["app", "trigger", "server", "widgets", "features"],
              message: "Entity must not import from upper layers (Features, Widgets, etc.)",
            },
            {
              from: ["features"],
              disallow: ["app", "trigger", "server", "widgets"],
              message: "Feature must not import from upper layers (Widgets, App)",
            },
            {
              from: ["widgets"],
              disallow: ["app", "trigger", "server"],
              message: "Widget must not import from App layer",
            },
            {
              from: ["shared", "entities", "features", "widgets"],
              disallow: ["server"],
              message:
                "Client-side layers cannot import direct server code (use API/Actions instead)",
            },
            {
              from: ["app"],
              disallow: ["trigger"],
            },
          ],
        },
      ],

      "unused-imports/no-unused-imports": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
          ignore: ["README.md"],
        },
      ],

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/strict-boolean-expressions": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",

      ...jsxA11y.configs.recommended.rules,
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
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  prettierConfig,
]);
