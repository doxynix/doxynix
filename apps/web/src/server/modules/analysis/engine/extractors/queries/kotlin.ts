import type { LanguageQuerySpec } from "./types";

export const kotlinQuerySpec: LanguageQuerySpec = {
  calls: `
    (call_expression . (simple_identifier) @call.name) @call.expression
    (call_expression
      (navigation_expression (navigation_suffix (simple_identifier) @call.method))) @call.expression
  `,
  complexity: `
    (if_expression) @complexity.branch
    (when_entry) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_while_statement) @complexity.branch
    (try_expression) @complexity.branch
  `,
  complexityNodeTypes: [
    "if_expression",
    "when_entry",
    "for_statement",
    "while_statement",
    "do_while_statement",
    "try_expression",
  ],
  entrypoints: `
    (function_declaration . (simple_identifier) @entrypoint.runtime (#eq? @entrypoint.runtime "main")) @entrypoint.call
  `,
  exports: "",
  imports: `(import_header (identifier) @import.source) @import.statement`,
  nestingNodeTypes: [
    "function_declaration",
    "class_declaration",
    "object_declaration",
    "if_expression",
    "when_expression",
    "for_statement",
    "while_statement",
    "do_while_statement",
    "try_expression",
  ],
  routes: "",
  symbols: `
    (function_declaration (simple_identifier) @symbol.function.name) @symbol.function
    (class_declaration (type_identifier) @symbol.class.name) @symbol.class
    (object_declaration (type_identifier) @symbol.class.name) @symbol.class
  `,
};
