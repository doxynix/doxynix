import type { LanguageQuerySpec } from "./types";

export const swiftQuerySpec: LanguageQuerySpec = {
  calls: `(call_expression (simple_identifier) @call.name) @call.expression`,
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (repeat_while_statement) @complexity.branch
    (switch_statement) @complexity.branch
    (catch_block) @complexity.branch
  `,
  entrypoints: "",
  exports: "",
  imports: `(import_declaration (identifier) @import.source) @import.statement`,
  isExported: (node) => node.text.includes("public ") || node.text.includes("open "),
  nestingNodeTypes: [
    "function_declaration",
    "class_declaration",
    "if_statement",
    "for_statement",
    "while_statement",
    "repeat_while_statement",
    "switch_statement",
    "catch_block",
  ],
  routes: "",
  symbols: `
    (function_declaration name: (simple_identifier) @symbol.function.name) @symbol.function
    (class_declaration name: (type_identifier) @symbol.class.name body: (class_body)) @symbol.class
    (protocol_declaration name: (type_identifier) @symbol.interface.name) @symbol.interface
    (class_declaration name: (type_identifier) @symbol.enum.name body: (enum_class_body)) @symbol.enum
  `,
};
