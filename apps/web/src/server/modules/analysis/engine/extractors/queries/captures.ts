import type Parser from "web-tree-sitter";

export function capturesByName(captures: Parser.QueryCapture[]): Map<string, Parser.SyntaxNode[]> {
  const map = new Map<string, Parser.SyntaxNode[]>();

  for (const capture of captures) {
    const nodes = map.get(capture.name);
    if (nodes == null) {
      map.set(capture.name, [capture.node]);
    } else {
      nodes.push(capture.node);
    }
  }

  return map;
}

export function firstCapture(
  map: Map<string, Parser.SyntaxNode[]>,
  name: string,
): Parser.SyntaxNode | undefined {
  return map.get(name)?.[0];
}
