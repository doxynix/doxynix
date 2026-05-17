import tanstackQuery from "@tanstack/eslint-plugin-query";
import tsParser from "@typescript-eslint/parser";
import vitest from "@vitest/eslint-plugin";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import jsxA11y from "eslint-plugin-jsx-a11y";
import noBarrelFiles from "eslint-plugin-no-barrel-files";
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
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "next-env.d.ts",
      "src/shared/api-contracts/**",
      "vitest.config.ts",
      "eslint.config.mjs",
      "postcss.config.mjs",
      "next.config.mjs",
      ".dependency-cruiser.js",
      "coverage/**",
      "report/**",
      ".trigger/**",
      "cli/index.js",
      "commitlint.config.js",
      "./scripts",
      "messages/en.d.json.ts",
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
      "no-barrel-files": noBarrelFiles,
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
        // --- Frontend (FSD) ---
        { type: "app", pattern: "src/app/**/*" },
        { type: "widgets", pattern: "src/widgets/**/*" },
        { type: "features", pattern: "src/features/**/*" },
        { type: "entities", pattern: "src/entities/**/*" },

        // --- Shared Foundation ---
        { type: "shared-ui", pattern: "src/shared/ui/**/*" },
        { type: "shared-lib", pattern: "src/shared/lib/**/*" },
        { type: "shared-contracts", pattern: "src/shared/api-contracts/**/*" },
        { type: "i18n", pattern: "src/shared/i18n/**/*" },
        { type: "shared-api", pattern: "src/shared/api/**/*" },

        // --- Backend (Modular Monolith) ---
        { type: "server-core", pattern: "src/server/core/**/*" },
        { type: "server-utils", pattern: "src/server/utils/**/*" },
        { type: "server-modules", pattern: "src/server/modules/*" },
      ],
      "jsx-a11y": {
        polymorphicPropName: "asChild",
        components: {
          Accordion: "div",
          Badge: "span",
          Button: "button",
          Checkbox: "input",
          Input: "input",
          Label: "label",
          Select: "select",
          Table: "table",
          Textarea: "textarea",
          Link: "a",
          Image: "img",
          NextImage: "img",
        },
      },
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
      "no-implicit-coercion": ["error", { allow: ["!!"] }],
      "unicorn/prefer-node-protocol": "error",
      "unicorn/catch-error-name": "error",
      "unicorn/prefer-optional-catch-binding": "error",
      "unicorn/consistent-function-scoping": "error",
      "unicorn/prefer-top-level-await": "error",
      "unicorn/no-await-expression-member": "error",
      "unicorn/no-useless-fallback-in-spread": "error",
      "unicorn/no-array-callback-reference": "error",
      "unicorn/no-instanceof-array": "error",
      "unicorn/no-thenable": "error",
      "unicorn/no-document-cookie": "error",
      "unicorn/prefer-set-has": "error",
      "unicorn/prefer-array-find": "error",
      "unicorn/prefer-array-some": "error",
      "unicorn/prefer-array-flat": "error",
      "unicorn/prefer-logical-operator-over-ternary": "error",
      "unicorn/no-unreadable-array-destructuring": "error",
      "unicorn/prefer-date-now": "error",
      "unicorn/no-lonely-if": "error",
      "unicorn/numeric-separators-style": "error",
      "unicorn/prefer-default-parameters": "error",
      "unicorn/prefer-string-replace-all": "error",
      "unicorn/prefer-includes": "error",
      "unicorn/prefer-dom-node-append": "error",
      "unicorn/prefer-dom-node-remove": "error",
      "unicorn/prefer-modern-math-apis": "error",
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/no-keyword-prefix": "off",
      "unicorn/no-for-loop": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/better-regex": "error",
      "unicorn/error-message": "error",
      "unicorn/no-unnecessary-await": "error",
      "unicorn/no-useless-spread": "error",
      "unicorn/no-useless-undefined": "error",
      "unicorn/prefer-array-flat-map": "error",
      "unicorn/prefer-at": "error",
      "unicorn/prefer-native-coercion-functions": "error",
      "unicorn/prefer-string-slice": "error",
      "unicorn/prefer-string-starts-ends-with": "error",
      "unicorn/switch-case-braces": ["error", "always"],
      "unicorn/throw-new-error": "error",
      "unicorn/no-process-exit": "error",
      "unicorn/prefer-simple-condition-first": "error",
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
          ignore: ["README.md"],
        },
      ],

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
      "sonarjs/deprecation": "off", // NOTE: долговатый слишком не окупается

      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],

      "validate-jsx-nesting/no-invalid-jsx-nesting": "error",

      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: { type: "app|widgets|features|entities" },
              disallow: [{ to: { type: "server-modules|server-core" } }],
              allow: [
                {
                  to: { type: "server-modules|server-core" },
                  dependency: { kind: "type" },
                },
              ],
              message: "UI layers cannot import server logic. Use tRPC hooks or Server Actions.",
            },
            {
              from: { type: "server-modules" },
              allow: [
                { to: { type: "server-core" } },
                { to: { type: "server-utils" } },
                { to: { type: "shared-contracts" } },
                { to: { type: "shared-lib" } },
                { to: { type: "server-modules", path: "src/server/modules/*/*.ts" } },
              ],
              disallow: [{ to: { type: "server-modules", path: "src/server/modules/*/*/**" } }],
              message:
                "VSA Violation: Accessing internal logic of another module is forbidden. Use the module's Public API (router/index).",
            },
            {
              from: { type: "server-core" },
              disallow: [{ to: { type: "server-modules|app|widgets|features|entities" } }],
              message: "Infrastructure Violation: Core must not depend on business logic or UI.",
            },
            {
              from: { type: "server-utils" },
              disallow: [
                { to: { type: "server-modules|server-core|app|widgets|features|entities" } },
              ],
              message: "Utility Violation: Utils must be pure.",
            },
            {
              from: { type: "shared|shared-contracts|i18n" },
              disallow: [
                { to: { type: "app|widgets|features|entities|server-core|server-modules" } },
              ],
              allow: [
                {
                  to: { type: "server-modules|server-core|server-utils" },
                  dependency: { kind: "type" },
                },
              ],
              message:
                "FSD Violation: Shared/Contracts layers cannot depend on upper layers or server logic.",
            },
            {
              from: { type: "entities" },
              disallow: [{ to: { type: "features|widgets|app" } }, { to: { type: "entities" } }],
              message:
                "FSD Violation: Entities are independent and cannot import upper layers or other entities.",
            },
            {
              from: { type: "features" },
              disallow: [{ to: { type: "widgets|app" } }, { to: { type: "features" } }],
              message: "FSD Violation: Features cannot import upper layers or other features.",
            },
            {
              from: { type: "widgets" },
              disallow: [{ to: { type: "app" } }, { to: { type: "widgets" } }],
              message: "FSD Violation: Widgets cannot import the App layer or other widgets.",
            },
            {
              from: { type: "app" },
              disallow: [{ to: { type: "app" } }],
              message: "FSD Violation: App routes should not import other routes.",
            },
          ],
        },
      ],

      "no-restricted-syntax": [
        "error",
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

      "no-barrel-files/no-barrel-files": "error",

      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
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
      "import/no-cycle": ["off", { maxDepth: 10 }], // NOTE: очень долго выполняется (заменен на dependency-cruiser)
      "import/no-self-import": "error",

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
            { groupName: "identifier", elementNamePattern: "^(id|name|src|alt)$" },
            { groupName: "routing", elementNamePattern: "^(href|to)$" },
            {
              groupName: "state",
              elementNamePattern: "^(type|value|defaultValue|checked|disabled)$",
            },
            { groupName: "aria", elementNamePattern: "^aria-" },
            { groupName: "data", elementNamePattern: "^data-" },
            { groupName: "callback", elementNamePattern: "^on[A-Z]" },
            { groupName: "style", elementNamePattern: "^(className|style|.*Class.*|.*Style.*)$" },
          ],
        },
      ],
      "perfectionist/sort-objects": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-classes": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-decorators": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-interfaces": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-object-types": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-intersection-types": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-exports": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-named-exports": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-union-types": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-enums": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-maps": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-sets": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-heritage-clauses": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-array-includes": ["error", { type: "natural", order: "asc" }],

      ...jsxA11y.flatConfigs.strict.rules,

      "jsx-a11y/aria-activedescendant-has-tabindex": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/aria-role": ["error", { ignoreNonDOM: true }],
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/control-has-associated-label": "off",
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/tabindex-no-positive": "error",
      "jsx-a11y/no-noninteractive-tabindex": "error",
      "jsx-a11y/media-has-caption": "error",
      "jsx-a11y/no-access-key": "error",
      "jsx-a11y/lang": "error",
      "jsx-a11y/img-redundant-alt": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/prefer-tag-over-role": "error",
      "jsx-a11y/autocomplete-valid": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/mouse-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/no-noninteractive-element-interactions": [
        "error",
        {
          handlers: ["onClick", "onMouseDown", "onMouseUp", "onKeyPress", "onKeyDown", "onKeyUp"],
        },
      ],
      "jsx-a11y/no-interactive-element-to-noninteractive-role": "error",
      "jsx-a11y/no-noninteractive-element-to-interactive-role": [
        "error",
        {
          ul: ["listbox", "menu", "menubar", "radiogroup", "tablist", "tree", "treegrid"],
          ol: ["listbox", "menu", "menubar", "radiogroup", "tablist", "tree", "treegrid"],
          li: ["menuitem", "option", "row", "tab", "treeitem"],
          table: ["grid"],
          td: ["gridcell"],
        },
      ],

      "jsx-a11y/alt-text": [
        "error",
        {
          elements: ["img", "object", "area", 'input[type="image"]'],
          img: ["Image", "NextImage"],
        },
      ],
      "jsx-a11y/anchor-is-valid": [
        "error",
        {
          components: ["Link"],
          specialLink: ["hrefLeft", "hrefRight"],
          aspects: ["invalidHref", "preferButton"],
        },
      ],
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/scope": "error",
      "jsx-a11y/no-aria-hidden-on-focusable": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/html-has-lang": "error",
      "jsx-a11y/iframe-has-title": "error",
      "jsx-a11y/no-distracting-elements": "error",

      "jsx-a11y/label-has-associated-control": [
        // NOTE: отключено по причине ошибки в пакете minimatch
        "off",
        {
          labelComponents: ["Label"],
          labelAttributes: ["htmlFor"],
          controlComponents: ["Input", "Select", "Textarea", "Checkbox", "Switch"],
          assert: "either",
          depth: 3,
        },
      ],
    },
  },
  {
    files: ["src/server/**/*.{ts,tsx,js}"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },

  {
    files: [
      "src/server/shared/engine/extractors/regex-signal-specs.ts",
      "src/server/shared/engine/extractors/tree-sitter-signals.ts",
      "src/server/shared/engine/core/graph.ts",
    ],
    rules: {
      "sonarjs/concise-regex": "off",
      "sonarjs/duplicates-in-character-class": "off",
      "sonarjs/single-char-in-character-classes": "off",
      "sonarjs/slow-regex": "off",
    },
  },

  {
    files: [
      "src/server/shared/engine/extractors/tree-sitter-signals.ts",
      "src/server/shared/engine/core/fact-collector.ts",
      "src/server/shared/engine/extractors/openapi-inventory.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/strict-boolean-expressions": "off",
    },
  },

  {
    files: [
      "src/server/shared/engine/metrics/code-metrics.ts",
      "src/server/shared/engine/metrics/common-metrics.ts",
    ],
    rules: {
      "import/no-cycle": "off",
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
