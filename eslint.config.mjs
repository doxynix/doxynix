import tanstackQuery from "@tanstack/eslint-plugin-query";
import tsParser from "@typescript-eslint/parser";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import jsxA11y from "eslint-plugin-jsx-a11y";
import perfectionist from "eslint-plugin-perfectionist";
import prettierPlugin from "eslint-plugin-prettier";
import reactPlugin from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import sonarjs from "eslint-plugin-sonarjs";
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
      "cli/index.js",
      "commitlint.config.js",
    ],
  },

  ...nextVitals,
  ...nextTs,
   sonarjs.configs.recommended,

  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "unused-imports": unusedImportsPlugin,
      "react-compiler": reactCompiler,
      "@tanstack/query": tanstackQuery,
      boundaries: boundaries,
      prettier: prettierPlugin,
      unicorn,
      perfectionist,
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
        { type: "generated", pattern: "src/generated/*" },
        { type: "server", pattern: "src/server/*" },
        { type: "trigger", pattern: "src/trigger/*" },
      ],
    },

    rules: {
      "prettier/prettier": "error",

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-compiler/react-compiler": "error",

      "react/no-children-prop": "error",
      "react/no-array-index-key": "off",

      "@tanstack/query/exhaustive-deps": "error",
      "@tanstack/query/no-rest-destructuring": "warn",
      "@tanstack/query/stable-query-client": "error",

      eqeqeq: ["error", "always", { null: "ignore" }],
      "unicorn/prefer-node-protocol": "error",

      "no-unneeded-ternary": "error",
      "sonarjs/cognitive-complexity": ["off", 15], // NOTE: пока выключен я пока не хочу рефакторить некоторый код
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-collapsible-if": "error",
      "sonarjs/no-all-duplicated-branches": "error",
      "sonarjs/prefer-immediate-return": "error",
      "sonarjs/no-inverted-boolean-check": "error",
      "sonarjs/no-redundant-jump": "error",
      "sonarjs/no-nested-functions": ["off", { threshold: 4 }], // NOTE: пока выключен я пока не хочу рефакторить некоторый код


      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-commented-code": "off",
      "sonarjs/no-nested-template-literals": "off",
      "sonarjs/todo-tag": "off",
      "sonarjs/fixme-tag": "off",
      "sonarjs/pseudo-random": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/void-use": "off",
      "sonarjs/function-return-type": "off",

      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],

      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: ["shared", "generated"],
              disallow: ["app", "trigger", "widgets", "features", "entities"],
              message: "Shared/Generated module must not import from upper layers",
            },
            {
              from: ["entities"],
              disallow: ["app", "trigger", "widgets", "features"],
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
              from: ["features", "widgets"],
              disallow: ["server"],
              message:
                "UI-focused layers (Features/Widgets) cannot import direct server code. Use shared/api instead.",
            },
            {
              from: ["app"],
              disallow: ["trigger"],
            },
          ],
        },
      ],

      "unused-imports/no-unused-imports": "error",
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
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",

      "perfectionist/sort-jsx-props": [
        "error",
        {
          type: "natural",
          order: "asc",
          groups: [
            "meta",
            "polymorphic",
            "identifier",
            "routing",
            "state",
            "shorthand-prop",
            "unknown",
            "aria",
            "data",
            "callback",
            "style",
          ],
          customGroups: [
            { groupName: "meta", elementNamePattern: "^(key|ref)$" },
            { groupName: "polymorphic", elementNamePattern: "^(as|asChild)$" },
            { groupName: "identifier", elementNamePattern: "^(id|name)$" },
            { groupName: "routing", elementNamePattern: "^(href|to)$" },
            { groupName: "state", elementNamePattern: "^(type|value|defaultValue)$" },
            { groupName: "aria", elementNamePattern: "^aria-" },
            { groupName: "data", elementNamePattern: "^data-" },
            { groupName: "callback", elementNamePattern: "^on[A-Z]" },
            { groupName: "style", elementNamePattern: "^(className|style)$" }
          ],
        },
      ],
      "perfectionist/sort-objects": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-interfaces": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-object-types": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-intersection-types": ["error", { type: "natural", order: "asc" }],

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
      "sonarjs/cognitive-complexity": "off",
      "react/no-array-index-key": "off",
      "sonarjs/deprecation": "off",
      "sonarjs/no-hardcoded-passwords": "off",
      "sonarjs/assertions-in-tests": "off",
    },
  },

  prettierConfig,
]);
