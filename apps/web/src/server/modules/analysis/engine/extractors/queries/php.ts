import type { LanguageQuerySpec } from "./types";

export const phpQuerySpec: LanguageQuerySpec = {
  calls: `
    (function_call_expression function: (name) @call.name) @call.expression
    (member_call_expression object: (variable_name) @call.object name: (name) @call.method) @call.expression
    (object_creation_expression) @call.expression
  `,
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (foreach_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_statement) @complexity.branch
    (catch_clause) @complexity.branch
    (conditional_expression) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  entrypoints: "",
  exports: "",
  imports: `
    (namespace_use_declaration (namespace_use_clause (qualified_name) @import.source)) @import.statement
    (require_expression (encapsed_string (string_content) @import.source)) @import.statement
    (include_expression (encapsed_string (string_content) @import.source)) @import.statement
  `,
  isExported: (node) =>
    node.children.some((child) => child.type === "visibility_modifier" && child.text === "public"),
  nestingNodeTypes: [
    "method_declaration",
    "function_definition",
    "class_declaration",
    "if_statement",
    "for_statement",
    "foreach_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "catch_clause",
  ],
  normalizeRouteMethod: (raw) => raw.toUpperCase(),
  routes: `
    (scoped_call_expression
      scope: (name) @route.receiver
      name: (name) @route.method
      arguments: (arguments (argument (encapsed_string (string_content) @route.path)))) @route.call
  `,
  symbols: `
    (class_declaration name: (name) @symbol.class.name) @symbol.class
    (interface_declaration name: (name) @symbol.interface.name) @symbol.interface
    (trait_declaration name: (name) @symbol.trait.name) @symbol.trait
    (function_definition name: (name) @symbol.function.name) @symbol.function
    (method_declaration name: (name) @symbol.method.name) @symbol.method
  `,
};
