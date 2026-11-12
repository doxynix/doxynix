import type Parser from "web-tree-sitter";

export type LanguageQuerySpec = {
  symbols: string;
  imports: string;
  exports: string;
  routes: string;
  entrypoints: string;
  complexity?: string;
  calls?: string;
  nestingNodeTypes: string[];
  detectFramework?: (imports: Set<string>) => string | undefined;
  normalizeRouteMethod?: (raw: string) => string;
  isExported?: (node: Parser.SyntaxNode, name: string) => boolean;
};
