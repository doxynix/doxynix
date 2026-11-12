import type { LanguageQuerySpec } from "./types";

export const pythonQuerySpec: LanguageQuerySpec = {
  calls: `
    (call function: (identifier) @call.name) @call.expression
    (call function: (attribute attribute: (identifier) @call.method)) @call.expression
  `,
  complexity: `
    (if_statement) @complexity.branch
    (elif_clause) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (try_statement) @complexity.branch
    (except_clause) @complexity.branch
    (with_statement) @complexity.branch
    (conditional_expression) @complexity.branch
    (boolean_operator operator: "and") @complexity.branch
    (boolean_operator operator: "or") @complexity.branch
  `,
  detectFramework: (imports) => {
    if (imports.has("fastapi")) {
      return "FastAPI";
    }
    if (imports.has("flask")) {
      return "Flask";
    }
    if (imports.has("django")) {
      return "Django";
    }
    return undefined;
  },
  entrypoints: "",
  exports: "",
  imports: `
    (import_statement name: (dotted_name) @import.source) @import.statement
    (import_from_statement module_name: (dotted_name) @import.source) @import.statement
    (import_from_statement module_name: (relative_import) @import.source) @import.statement
  `,
  isExported: (node, name) =>
    !name.startsWith("_") &&
    (node.parent?.type === "module" || node.parent?.parent?.type === "module"),
  nestingNodeTypes: [
    "function_definition",
    "class_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "try_statement",
    "with_statement",
    "match_statement",
  ],
  routes: `
    (decorator
      (call
        function: (attribute object: (identifier) @route.receiver attribute: (identifier) @route.method)
        arguments: (argument_list (string (string_content) @route.path)))) @route.call
  `,
  symbols: `
    (function_definition name: (identifier) @symbol.function.name) @symbol.function
    (class_definition name: (identifier) @symbol.class.name) @symbol.class
  `,
};
