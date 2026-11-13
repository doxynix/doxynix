import type { LanguageQuerySpec } from "./types";

export const javaQuerySpec: LanguageQuerySpec = {
  calls: `
    (method_invocation name: (identifier) @call.name) @call.expression
    (method_invocation object: (_) @call.object name: (identifier) @call.method) @call.expression
    (object_creation_expression type: (type_identifier) @call.constructor) @call.expression
  `,
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (enhanced_for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_expression) @complexity.branch
    (catch_clause) @complexity.branch
    (ternary_expression) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  complexityNodeTypes: [
    "if_statement",
    "for_statement",
    "enhanced_for_statement",
    "while_statement",
    "do_statement",
    "switch_expression",
    "catch_clause",
    "ternary_expression",
  ],
  entrypoints: `
    (method_declaration name: (identifier) @entrypoint.runtime (#eq? @entrypoint.runtime "main")) @entrypoint.call
  `,
  exports: "",
  imports: `
    (import_declaration (scoped_identifier) @import.source) @import.statement
  `,
  isExported: (node) =>
    node.children.some((child) => child.type === "modifiers" && child.text.includes("public")),
  nestingNodeTypes: [
    "method_declaration",
    "constructor_declaration",
    "class_declaration",
    "if_statement",
    "for_statement",
    "enhanced_for_statement",
    "while_statement",
    "do_statement",
    "switch_expression",
    "catch_clause",
  ],
  normalizeRouteMethod: (raw) => raw.replace(/Mapping$/iu, "").toUpperCase(),
  routes: `
    (annotation name: (identifier) @route.method arguments: (annotation_argument_list (string_literal) @route.path)) @route.call
  `,
  symbols: `
    (class_declaration name: (identifier) @symbol.class.name) @symbol.class
    (interface_declaration name: (identifier) @symbol.interface.name) @symbol.interface
    (enum_declaration name: (identifier) @symbol.enum.name) @symbol.enum
    (record_declaration name: (identifier) @symbol.class.name) @symbol.class
    (method_declaration name: (identifier) @symbol.method.name) @symbol.method
    (constructor_declaration name: (identifier) @symbol.method.name) @symbol.method
  `,
};
