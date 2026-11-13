import type { LanguageQuerySpec } from "./types";

export const bashQuerySpec: LanguageQuerySpec = {
  calls: `(command name: (command_name (word) @call.name)) @call.expression`,
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (case_statement) @complexity.branch
  `,
  complexityNodeTypes: ["if_statement", "for_statement", "while_statement", "case_statement"],
  entrypoints: "",
  exports: "",
  imports: `
    (command name: (command_name (word) @import.command) (#match? @import.command "^(source|\\.)$") argument: (word) @import.source) @import.statement
  `,
  isExported: () => true,
  nestingNodeTypes: [
    "function_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "case_statement",
  ],
  routes: "",
  symbols: `(function_definition name: (word) @symbol.function.name) @symbol.function`,
};
