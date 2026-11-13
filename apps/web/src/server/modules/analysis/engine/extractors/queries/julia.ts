import type { LanguageQuerySpec } from "./types";

export const juliaQuerySpec: LanguageQuerySpec = {
  calls: `(call_expression . (identifier) @call.name) @call.expression`,
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (for_clause) @complexity.branch
    (while_statement) @complexity.branch
    (try_statement) @complexity.branch
    (ternary_expression) @complexity.branch
  `,
  complexityNodeTypes: [
    "if_statement",
    "for_statement",
    "for_clause",
    "while_statement",
    "try_statement",
    "ternary_expression",
  ],
  entrypoints: "",
  exports: `(export_statement (identifier) @export.name) @export.statement`,
  imports: `
    (using_statement (identifier) @import.source) @import.statement
    (import_statement (import_path) @import.source) @import.statement
  `,
  nestingNodeTypes: [
    "function_definition",
    "module_definition",
    "struct_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "try_statement",
    "let_statement",
    "do_clause",
  ],
  routes: "",
  symbols: `
    (function_definition (signature (call_expression . (identifier) @symbol.function.name))) @symbol.function
    (struct_definition (type_head [(identifier) @symbol.struct.name (binary_expression . (identifier) @symbol.struct.name)])) @symbol.struct
    (module_definition name: (identifier) @symbol.module.name) @symbol.module
  `,
};
