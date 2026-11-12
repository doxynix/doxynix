import type { LanguageQuerySpec } from "./types";

export const luaQuerySpec: LanguageQuerySpec = {
  calls: `(call function: (variable name: (identifier) @call.name)) @call.expression`,
  complexity: `
    (if_statement) @complexity.branch
    (for_numeric_statement) @complexity.branch
    (for_generic_statement) @complexity.branch
    (while_statement) @complexity.branch
    (repeat_statement) @complexity.branch
  `,
  entrypoints: "",
  exports: "",
  imports: `
    (call function: (variable name: (identifier) @import.require) (#eq? @import.require "require") arguments: (argument_list (expression_list (string) @import.source))) @import.statement
  `,
  isExported: () => true,
  nestingNodeTypes: [
    "function_definition",
    "local_function_definition_statement",
    "function_definition_statement",
    "if_statement",
    "for_numeric_statement",
    "for_generic_statement",
    "while_statement",
    "repeat_statement",
  ],
  routes: "",
  symbols: `
    (local_function_definition_statement name: (identifier) @symbol.function.name) @symbol.function
    (function_definition_statement name: (identifier) @symbol.function.name) @symbol.function
    (function_definition_statement name: (variable table: (identifier) field: (identifier) @symbol.method.name)) @symbol.method
  `,
};
