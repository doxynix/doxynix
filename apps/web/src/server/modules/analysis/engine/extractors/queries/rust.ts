import type { LanguageQuerySpec } from "./types";

export const rustQuerySpec: LanguageQuerySpec = {
  calls: `
    (call_expression function: (identifier) @call.name) @call.expression
    (call_expression function: (field_expression field: (field_identifier) @call.method)) @call.expression
  `,
  complexity: `
    (if_expression) @complexity.branch
    (for_expression) @complexity.branch
    (while_expression) @complexity.branch
    (loop_expression) @complexity.branch
    (match_arm) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  entrypoints: `
    (function_item name: (identifier) @entrypoint.runtime (#eq? @entrypoint.runtime "main")) @entrypoint.call
  `,
  exports: "",
  imports: `
    (use_declaration argument: (scoped_identifier) @import.source) @import.statement
    (use_declaration argument: (identifier) @import.source) @import.statement
  `,
  isExported: (node) => node.children.some((child) => child.type === "visibility_modifier"),
  nestingNodeTypes: [
    "function_item",
    "impl_item",
    "trait_item",
    "if_expression",
    "for_expression",
    "while_expression",
    "loop_expression",
    "match_expression",
  ],
  normalizeRouteMethod: (raw) => raw.toUpperCase(),
  routes: `
    (attribute_item
      (attribute (identifier) @route.method arguments: (token_tree (string_literal) @route.path))
      (#match? @route.method "^(get|post|put|patch|delete)$")) @route.call
  `,
  symbols: `
    (function_item name: (identifier) @symbol.function.name) @symbol.function
    (struct_item name: (type_identifier) @symbol.struct.name) @symbol.struct
    (enum_item name: (type_identifier) @symbol.enum.name) @symbol.enum
    (trait_item name: (type_identifier) @symbol.trait.name) @symbol.trait
    (mod_item name: (identifier) @symbol.module.name) @symbol.module
    (const_item name: (identifier) @symbol.const.name) @symbol.const
    (static_item name: (identifier) @symbol.variable.name) @symbol.variable
  `,
};
