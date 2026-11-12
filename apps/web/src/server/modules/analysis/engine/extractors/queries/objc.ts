import type { LanguageQuerySpec } from "./types";

export const objcQuerySpec: LanguageQuerySpec = {
  calls: `(call_expression function: (identifier) @call.name) @call.expression`,
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_statement) @complexity.branch
  `,
  entrypoints: "",
  exports: "",
  imports: `
    (preproc_include path: (system_lib_string) @import.source) @import.statement
    (preproc_include path: (string_literal) @import.source) @import.statement
    (module_import path: (identifier) @import.source) @import.statement
  `,
  isExported: () => true,
  nestingNodeTypes: [
    "method_definition",
    "function_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "switch_statement",
  ],
  routes: "",
  symbols: `
    (class_interface . (identifier) @symbol.class.name) @symbol.class
    (class_interface category: (identifier) @symbol.class.name) @symbol.class
    (class_implementation . (identifier) @symbol.class.name) @symbol.class
    (class_implementation category: (identifier) @symbol.class.name) @symbol.class
    (method_definition (identifier) @symbol.method.name) @symbol.method
    (method_declaration (identifier) @symbol.method.name) @symbol.method
  `,
};
