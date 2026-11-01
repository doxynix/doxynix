type MemoKeyPart = boolean | null | number | string | undefined;

type MemoStore = Map<string, Promise<unknown>>;

// Primitives only: `JSON.stringify` of a string never emits a raw NUL, so NUL separates fields
// without collision, and `undefined` gets its own encoding instead of collapsing into `null`.
function memoKey(scope: string, parts: readonly MemoKeyPart[]): string {
  return [scope, ...parts.map((part) => (part === undefined ? "" : JSON.stringify(part)))].join(
    "\u0000",
  );
}

// Deduplicates one async read per key inside a single request store. Not a cache: the store dies
// with the request, so the value cannot outlive the data it was derived from.
export function memoizeOnce<T>(
  store: MemoStore | undefined,
  scope: string,
  keyParts: readonly MemoKeyPart[],
  load: () => Promise<T>,
): Promise<T> {
  if (store == null) {
    return load();
  }

  const key = memoKey(scope, keyParts);
  const cached = store.get(key);

  if (cached != null) {
    // Safe: the key covers the scope and every input that changes the result, and only the caller
    // that wrote an entry reads that scope back.
    return cached as Promise<T>;
  }

  const pending = load();
  store.set(key, pending);

  return pending;
}
