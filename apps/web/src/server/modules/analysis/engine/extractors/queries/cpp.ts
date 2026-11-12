import type { LanguageQuerySpec } from "./types";

export const cppQuerySpec: LanguageQuerySpec = {
  calls: `
    (call_expression function: (identifier) @call.name) @call.expression
    (call_expression function: (field_expression field: (field_identifier) @call.method)) @call.expression
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
  entrypoints: "",
  exports: "",
  imports: `
    (preproc_include path: (system_lib_string) @import.source) @import.statement
    (preproc_include path: (string_literal) @import.source) @import.statement
  `,
  isExported: (node) => !node.text.startsWith("static "),
  nestingNodeTypes: [
    "function_definition",
    "class_specifier",
    "namespace_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
  ],
  routes: "",
  symbols: `
    (function_definition declarator: (function_declarator declarator: (identifier) @symbol.function.name)) @symbol.function
    (function_definition declarator: (function_declarator declarator: (field_identifier) @symbol.method.name)) @symbol.method
    (struct_specifier name: (type_identifier) @symbol.struct.name) @symbol.struct
    (class_specifier name: (type_identifier) @symbol.class.name) @symbol.class
    (enum_specifier name: (type_identifier) @symbol.enum.name) @symbol.enum
    (namespace_definition name: (namespace_identifier) @symbol.module.name) @symbol.module
  `,
};
