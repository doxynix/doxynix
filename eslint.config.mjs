import tanstackQuery from "@tanstack/eslint-plugin-query";
import tsParser from "@typescript-eslint/parser";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import perfectionist from "eslint-plugin-perfectionist";
import playwright from "eslint-plugin-playwright";
import prettierPlugin from "eslint-plugin-prettier";
import reactPlugin from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import validateJsxNesting from "eslint-plugin-validate-jsx-nesting";
import vitest from "eslint-plugin-vitest";
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
      "validate-jsx-nesting": validateJsxNesting,
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
        { type: "i18n", pattern: "src/i18n/*" },
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

      "validate-jsx-nesting/no-invalid-jsx-nesting": "error",

      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: ["shared", "generated", "i18n"],
              disallow: ["app", "trigger", "widgets", "features", "entities", "server"],
              message:
                "FSD Violation: Shared, Generated and i18n layers must be pure and cannot depend on upper layers or server logic.",
            },
            {
              from: ["entities"],
              disallow: ["app", "trigger", "widgets", "features", "server"],
              message:
                "FSD Violation: Entities should only depend on other Entities (check composition), Shared, or Generated. They cannot import Features, Widgets or direct Server code.",
            },
            {
              from: ["features"],
              disallow: ["app", "trigger", "widgets", "server"],
              message:
                "FSD Violation: Features can only depend on Entities or Shared. They cannot import Widgets, App, or direct Server code.",
            },
            {
              from: ["widgets"],
              disallow: ["app", "trigger", "server"],
              message:
                "FSD Violation: Widgets can depend on Features, Entities, and Shared. They cannot import the App layer or direct Server code.",
            },
            {
              from: ["server"],
              disallow: ["app", "trigger", "widgets", "features", "entities"],
              message:
                "Architectural Violation: The 'server' layer contains pure business logic and must not depend on UI layers (entities, features, etc.). Use shared/api for schemas.",
            },
            {
              from: ["trigger"],
              disallow: ["app", "widgets", "features", "entities"],
              message:
                "Architectural Violation: Trigger tasks should only depend on 'server' logic or 'shared' resources. Do not import UI components into background jobs.",
            },
            {
              from: ["features"],
              disallow: ["features"],
              message:
                "FSD Violation: Cross-import between Features is forbidden to prevent high coupling. Move shared logic to 'entities' or 'shared'.",
            },
            {
              from: ["entities"],
              disallow: ["entities"],
              message:
                "FSD Violation: Cross-import between Entities is forbidden. Use composition in 'features' or 'widgets' instead.",
            },
            {
              from: ["widgets"],
              disallow: ["widgets"],
              message: "FSD Violation: Widgets should not import other Widgets.",
            },
            {
              from: ["app"],
              disallow: ["trigger"],
              message:
                "Safety Violation: Do not import 'trigger' background task definitions directly into the 'app' router.",
            },
            {
              from: ["app"],
              disallow: ["app"],
              message:
                "FSD Violation: App routes should not import other routes. Use 'widgets' or 'features' for shared UI logic.",
            },
          ],
        },
      ],

      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/app/**/?*",
                "@/widgets/**/?*",
                "@/features/**/?*",
                "@/entities/**/?*",

                "!@/app/*",
                "!@/widgets/*",
                "!@/features/*",
                "!@/entities/*",
              ],
              message:
                "FSD Violation: Deep imports are forbidden. Import only from the Public API (index.ts) of the slice.",
            },
          ],
        },
      ],

      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message:
            "Next.js Performance: Do not use 'export *'. Export modules explicitly to avoid huge barrel files and tree-shaking issues.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] > JSXExpressionContainer > TemplateLiteral",
          message:
            "Use cn() utility for conditional Tailwind classes instead of template literals.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] > JSXExpressionContainer > BinaryExpression[operator='+']",
          message:
            "Use cn() utility for conditional Tailwind classes instead of string concatenation.",
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
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",

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
            { groupName: "style", elementNamePattern: "^(className|style)$" },
          ],
        },
      ],
      "perfectionist/sort-objects": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-interfaces": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-object-types": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-intersection-types": ["error", { type: "natural", order: "asc" }],
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

  {
    files: ["src/**/*.test.ts"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/prefer-expect-resolves": "error",
      "vitest/no-focused-tests": "error",
      "vitest/expect-expect": [
        "error",
        {
          assertFunctionNames: ["expect", "expectDenied", "expectValidationFail", "fc.assert"],
        },
      ],
    },
  },
  {
    files: ["src/tests/e2e/**/*.ts"],
    plugins: { playwright },
    rules: {
      ...playwright.configs.recommended.rules,
      "playwright/no-force-option": "error",
      "playwright/no-focused-test": "error",
      "playwright/require-soft-assertions": "warn",
    },
  },

  prettierConfig,
]);
