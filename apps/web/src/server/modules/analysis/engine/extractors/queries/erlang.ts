import type { LanguageQuerySpec } from "./types";

export const erlangQuerySpec: LanguageQuerySpec = {
  calls: `(call expr: (atom) @call.name) @call.expression`,
  complexity: `
    (if_expr) @complexity.branch
    (case_expr) @complexity.branch
    (receive_expr) @complexity.branch
    (try_expr) @complexity.branch
    (maybe_expr) @complexity.branch
  `,
  complexityNodeTypes: ["if_expr", "case_expr", "receive_expr", "try_expr", "maybe_expr"],
  entrypoints: `
    (function_clause name: (atom) @entrypoint.runtime (#eq? @entrypoint.runtime "main")) @entrypoint.call
  `,
  exports: `
    (export_attribute (fa fun: (atom) @export.name)) @export.statement
  `,
  imports: `
    (pp_include file: (string) @import.source) @import.statement
    (pp_include_lib file: (string) @import.source) @import.statement
  `,
  nestingNodeTypes: [
    "function_clause",
    "if_expr",
    "case_expr",
    "receive_expr",
    "try_expr",
    "fun_clause",
    "catch_clause",
  ],
  routes: "",
  symbols: `
    (function_clause name: (atom) @symbol.function.name) @symbol.function
    (module_attribute name: (atom) @symbol.module.name) @symbol.module
  `,
};
