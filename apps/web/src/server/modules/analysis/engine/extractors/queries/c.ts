import type { LanguageQuerySpec } from "./types";

export const cQuerySpec: LanguageQuerySpec = {
  calls: `
    (call_expression function: (identifier) @call.name) @call.expression
  `,
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_statement) @complexity.branch
    (case_statement) @complexity.branch
    (conditional_expression) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  complexityNodeTypes: [
    "if_statement",
    "for_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "case_statement",
    "conditional_expression",
  ],
  entrypoints: "",
  exports: "",
  imports: `
    (preproc_include path: (system_lib_string) @import.source) @import.statement
    (preproc_include path: (string_literal) @import.source) @import.statement
  `,
  isExported: (node) => !node.text.startsWith("static "),
  nestingNodeTypes: [
    "function_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
  ],
  routes: "",
  symbols: `
    (function_definition declarator: (function_declarator declarator: (identifier) @symbol.function.name)) @symbol.function
    (struct_specifier name: (type_identifier) @symbol.struct.name) @symbol.struct
    (enum_specifier name: (type_identifier) @symbol.enum.name) @symbol.enum
  `,
};
