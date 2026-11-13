import type { LanguageQuerySpec } from "./types";

export const csharpQuerySpec: LanguageQuerySpec = {
  calls: `
    (invocation_expression function: (identifier) @call.name) @call.expression
    (invocation_expression function: (member_access_expression expression: (_) @call.object name: (identifier) @call.method)) @call.expression
    (object_creation_expression type: (identifier) @call.constructor) @call.expression
  `,
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (for_each_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_statement) @complexity.branch
    (catch_clause) @complexity.branch
    (conditional_expression) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  complexityNodeTypes: [
    "if_statement",
    "for_statement",
    "for_each_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "catch_clause",
    "conditional_expression",
  ],
  entrypoints: `
    (method_declaration name: (identifier) @entrypoint.runtime (#eq? @entrypoint.runtime "Main")) @entrypoint.call
  `,
  exports: "",
  imports: `
    (using_directive (identifier) @import.source) @import.statement
    (using_directive (qualified_name) @import.source) @import.statement
  `,
  isExported: (node) =>
    node.children.some((child) => child.type === "modifier" && child.text === "public"),
  nestingNodeTypes: [
    "method_declaration",
    "constructor_declaration",
    "class_declaration",
    "if_statement",
    "for_statement",
    "for_each_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "catch_clause",
  ],
  normalizeRouteMethod: (raw) => raw.replace(/^Http/iu, "").toUpperCase(),
  routes: `
    (attribute name: (identifier) @route.method (attribute_argument_list (attribute_argument (string_literal) @route.path))) @route.call
  `,
  symbols: `
    (class_declaration name: (identifier) @symbol.class.name) @symbol.class
    (interface_declaration name: (identifier) @symbol.interface.name) @symbol.interface
    (struct_declaration name: (identifier) @symbol.struct.name) @symbol.struct
    (enum_declaration name: (identifier) @symbol.enum.name) @symbol.enum
    (record_declaration name: (identifier) @symbol.class.name) @symbol.class
    (method_declaration name: (identifier) @symbol.method.name) @symbol.method
  `,
};
