import type { LanguageQuerySpec } from "./types";

const SYMBOLS = `
  (function_declaration name: (identifier) @symbol.function.name) @symbol.function
  (generator_function_declaration name: (identifier) @symbol.function.name) @symbol.function
  (class_declaration name: (type_identifier) @symbol.class.name) @symbol.class
  (abstract_class_declaration name: (type_identifier) @symbol.class.name) @symbol.class
  (interface_declaration name: (type_identifier) @symbol.interface.name) @symbol.interface
  (type_alias_declaration name: (type_identifier) @symbol.type.name) @symbol.type
  (enum_declaration name: (identifier) @symbol.enum.name) @symbol.enum
  (method_definition name: (property_identifier) @symbol.method.name) @symbol.method
  (variable_declarator name: (identifier) @symbol.const.name value: (arrow_function)) @symbol.const
  (variable_declarator name: (identifier) @symbol.const.name value: (function_expression)) @symbol.const
`;

const IMPORTS = `
  (import_statement source: (string (string_fragment) @import.source)) @import.statement
  (import_statement
    (import_clause (identifier) @import.default)
    source: (string (string_fragment) @import.source)) @import.statement
  (import_statement
    (import_clause (namespace_import (identifier) @import.namespace))
    source: (string (string_fragment) @import.source)) @import.statement
  (import_statement
    (import_clause (named_imports (import_specifier name: (identifier) @import.named)))
    source: (string (string_fragment) @import.source)) @import.statement
  (call_expression function: (identifier) @import.require.fn arguments: (arguments (string (string_fragment) @import.source)) (#eq? @import.require.fn "require")) @import.require
  (call_expression function: (import) arguments: (arguments (string (string_fragment) @import.source))) @import.dynamic
  (export_statement source: (string (string_fragment) @import.source)) @import.reexport
`;

const EXPORTS = `
  (export_statement declaration: (function_declaration name: (identifier) @export.name)) @export.statement
  (export_statement declaration: (class_declaration name: (type_identifier) @export.name)) @export.statement
  (export_statement declaration: (lexical_declaration (variable_declarator name: (identifier) @export.name))) @export.statement
  (export_statement (export_clause (export_specifier name: (identifier) @export.name))) @export.statement
`;

const ROUTES = `
  (call_expression
    function: (member_expression
      object: (identifier) @route.receiver
      property: (property_identifier) @route.method)
    arguments: (arguments (string (string_fragment) @route.path))
    (#match? @route.method "^(get|post|put|patch|delete|options|head)$")
    (#match? @route.receiver "^(app|router|server|api|fastify|route|r)$")) @route.call
`;

const ENTRYPOINTS = `
  (call_expression function: (identifier) @entrypoint.runtime (#match? @entrypoint.runtime "^(serve|createServer|listen)$")) @entrypoint.call
  (new_expression constructor: (identifier) @entrypoint.runtime (#eq? @entrypoint.runtime "Hono")) @entrypoint.new
`;

const COMPLEXITY = `
  (if_statement) @complexity.branch
  (for_statement) @complexity.branch
  (for_in_statement) @complexity.branch
  (while_statement) @complexity.branch
  (do_statement) @complexity.branch
  (switch_statement) @complexity.branch
  (catch_clause) @complexity.branch
  (ternary_expression) @complexity.branch
  (binary_expression operator: "&&") @complexity.branch
  (binary_expression operator: "||") @complexity.branch
`;

const CALLS = `
  (call_expression function: (identifier) @call.name) @call.expression
  (call_expression function: (member_expression object: (identifier) @call.object property: (property_identifier) @call.method)) @call.expression
  (new_expression constructor: (identifier) @call.constructor) @call.expression
`;

export const typescriptQuerySpec: LanguageQuerySpec = {
  calls: CALLS,
  complexity: COMPLEXITY,
  detectFramework: (imports) => {
    if ([...imports].some((specifier) => specifier === "hono" || specifier.startsWith("hono/"))) {
      return "Hono";
    }
    if (imports.has("express")) {
      return "Express";
    }
    if (
      [...imports].some((specifier) => specifier === "fastify" || specifier.startsWith("fastify/"))
    ) {
      return "Fastify";
    }
    return undefined;
  },
  entrypoints: ENTRYPOINTS,
  exports: EXPORTS,
  imports: IMPORTS,
  nestingNodeTypes: [
    "function_declaration",
    "method_definition",
    "arrow_function",
    "class_declaration",
    "if_statement",
    "for_statement",
    "for_in_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "catch_clause",
  ],
  routes: ROUTES,
  symbols: SYMBOLS,
};
