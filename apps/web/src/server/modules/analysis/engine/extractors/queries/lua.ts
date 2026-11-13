import type { LanguageQuerySpec } from "./types";

export const luaQuerySpec: LanguageQuerySpec = {
  calls: `(function_call name: (identifier) @call.name) @call.expression`,
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (repeat_statement) @complexity.branch
  `,
  complexityNodeTypes: ["if_statement", "for_statement", "while_statement", "repeat_statement"],
  entrypoints: "",
  exports: "",
  imports: `
    (function_call name: (identifier) @import.require (#eq? @import.require "require") arguments: (arguments (string) @import.source)) @import.statement
  `,
  isExported: () => true,
  nestingNodeTypes: [
    "function_declaration",
    "function_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "repeat_statement",
  ],
  routes: "",
  symbols: `
    (function_declaration name: (identifier) @symbol.function.name) @symbol.function
    (function_declaration name: (dot_index_expression field: (identifier) @symbol.method.name)) @symbol.method
    (function_declaration name: (method_index_expression method: (identifier) @symbol.method.name)) @symbol.method
  `,
};
