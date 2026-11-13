import type { Node, QueryCapture } from "web-tree-sitter";

export function capturesByName(captures: QueryCapture[]): Map<string, Node[]> {
  const map = new Map<string, Node[]>();

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

export function firstCapture(map: Map<string, Node[]>, name: string): Node | undefined {
  return map.get(name)?.[0];
}
