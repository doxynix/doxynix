import type { LanguageQuerySpec } from "./types";

export const rubyQuerySpec: LanguageQuerySpec = {
  calls: `(call method: (identifier) @call.name) @call.expression`,
  complexity: `
    (if) @complexity.branch
    (unless) @complexity.branch
    (while) @complexity.branch
    (until) @complexity.branch
    (for) @complexity.branch
    (when) @complexity.branch
    (rescue) @complexity.branch
  `,
  complexityNodeTypes: ["if", "unless", "while", "until", "for", "when", "rescue"],
  entrypoints: "",
  exports: "",
  imports: `
    (call method: (identifier) @import.require (#eq? @import.require "require") arguments: (argument_list (string) @import.source)) @import.statement
  `,
  isExported: () => true,
  nestingNodeTypes: [
    "method",
    "singleton_method",
    "class",
    "module",
    "if",
    "unless",
    "while",
    "until",
    "for",
    "case",
    "begin",
    "do_block",
    "block",
    "lambda",
  ],
  routes: "",
  symbols: `
    (method name: (identifier) @symbol.function.name) @symbol.function
    (singleton_method name: (identifier) @symbol.method.name) @symbol.method
    (class name: (constant) @symbol.class.name) @symbol.class
    (module name: (constant) @symbol.module.name) @symbol.module
  `,
};
