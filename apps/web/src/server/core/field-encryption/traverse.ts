export type NodeType = "array" | "boolean" | "null" | "number" | "object" | "string" | "undefined";

export type TreeNode = {
  key: string;
  path: string[];
  type: NodeType;
  value: unknown;
};

type Frame<TState> = { key: string; path: string[]; state: TState; value: unknown };

const MAX_DEPTH = 64;

/**
 * Iterative depth-first walk in declaration order, replacing the library's
 * `traverseTree`. The callback is invoked for the root and for every child as
 * it is popped, and the state it returns is carried into that node's own
 * subtree - that is how a relation key switches the tracked model.
 */
export function traverseTree<TState>(
  input: unknown,
  callback: (state: TState, node: TreeNode) => TState,
  initialState: TState,
): void {
  const seen = new WeakSet<object>();
  const stack: Array<Frame<TState>> = [{ key: "", path: [], state: initialState, value: input }];

  while (stack.length > 0) {
    const frame = stack.pop();

    if (frame == null || frame.path.length > MAX_DEPTH) {
      continue;
    }

    const value = frame.value;
    const isCollection = isPlainObject(value) || Array.isArray(value);

    // A Prisma `args` object is acyclic in practice, but nothing stops a
    // caller from handing us a cycle. One visit per object is enough.
    if (isCollection) {
      if (seen.has(value)) {
        continue;
      }
      seen.add(value);
    }

    const state = callback(frame.state, {
      key: frame.key,
      path: frame.path,
      type: typeOf(value),
      value,
    });

    if (!isCollection) {
      continue;
    }

    const entries = Object.entries(value);
    // Reversed so the LIFO stack pops them in declaration order, which is what
    // `prisma-field-encryption`'s `traverseTree` did.
    for (const [key, child] of entries.toReversed()) {
      stack.push({ key, path: [...frame.path, key], state, value: child });
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function typeOf(value: unknown): NodeType {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "object") {
    return "object";
  }
  return typeof value as NodeType;
}
