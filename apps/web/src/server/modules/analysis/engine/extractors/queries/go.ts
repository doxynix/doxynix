import type { LanguageQuerySpec } from "./types";

export const goQuerySpec: LanguageQuerySpec = {
  calls: `
    (call_expression function: (identifier) @call.name) @call.expression
    (call_expression function: (selector_expression operand: (_) @call.object field: (field_identifier) @call.method)) @call.expression
  `,
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (expression_case) @complexity.branch
    (type_case) @complexity.branch
    (communication_case) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  detectFramework: (imports) => {
    if (imports.has("github.com/gin-gonic/gin")) {
      return "Gin";
    }
    if (imports.has("github.com/labstack/echo/v4")) {
      return "Echo";
    }
    return undefined;
  },
  entrypoints: `
    (function_declaration name: (identifier) @entrypoint.runtime (#eq? @entrypoint.runtime "main")) @entrypoint.call
  `,
  exports: "",
  imports: `
    (import_spec path: (interpreted_string_literal) @import.source) @import.statement
  `,
  isExported: (_node, name) => /^[A-Z]/u.test(name),
  nestingNodeTypes: [
    "function_declaration",
    "method_declaration",
    "if_statement",
    "for_statement",
    "expression_switch_statement",
    "type_switch_statement",
    "select_statement",
  ],
  normalizeRouteMethod: (raw) => raw.toUpperCase(),
  routes: `
    (call_expression
      function: (selector_expression operand: (identifier) @route.receiver field: (field_identifier) @route.method)
      arguments: (argument_list (interpreted_string_literal) @route.path)
      (#match? @route.method "^(GET|POST|PUT|PATCH|DELETE)$")) @route.call
  `,
  symbols: `
    (function_declaration name: (identifier) @symbol.function.name) @symbol.function
    (method_declaration name: (field_identifier) @symbol.method.name) @symbol.method
    (type_declaration (type_spec name: (type_identifier) @symbol.struct.name type: (struct_type))) @symbol.struct
    (type_declaration (type_spec name: (type_identifier) @symbol.interface.name type: (interface_type))) @symbol.interface
  `,
};
