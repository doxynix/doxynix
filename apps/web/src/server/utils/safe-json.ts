/**
 * Deep-clones through JSON, replacing cycles and bigints.
 *
 * The `T` is a caller assertion, not a guarantee: `JSON.parse` cannot know the
 * shape it produced. The only two callers pass `Prisma.InputJsonValue` for a
 * value that was already assembled as JSON, so the cast is sound in practice.
 * A clone that could return a validated `T` would need a schema per call site.
 */
export function safeJsonClone<T = unknown>(
  value: unknown,
  replacer?: (key: string, value: unknown) => unknown,
): T {
  if (value == null) {
    return undefined as T;
  }

  const seen = new WeakSet();

  const json = JSON.stringify(value, function (this: unknown, key: string, val: unknown) {
    const current = replacer ? replacer.call(this, key, val) : val;

    if (typeof current === "bigint") {
      return current.toString();
    }

    if (typeof current === "object" && current !== null) {
      if (seen.has(current)) {
        return "[Circular]";
      }
      seen.add(current);
    }

    return current;
  });

  return JSON.parse(json) as T;
}
