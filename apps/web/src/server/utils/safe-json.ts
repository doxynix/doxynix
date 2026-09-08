export function safeJsonClone<T = unknown>(
  value: unknown,
  replacer?: (key: string, value: unknown) => unknown,
): T {
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
