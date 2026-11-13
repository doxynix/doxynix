import type { ModuleRef, SymbolRef } from "./discovery.types";

export type SymbolIndex = {
  byPath: Map<string, Map<string, SymbolRef>>;
  exportedByPath: Map<string, Map<string, SymbolRef>>;
};

export function buildSymbolIndex(modules: ModuleRef[]): SymbolIndex {
  const byPath = new Map<string, Map<string, SymbolRef>>();
  const exportedByPath = new Map<string, Map<string, SymbolRef>>();

  for (const moduleRef of modules) {
    const all = new Map<string, SymbolRef>();
    const exported = new Map<string, SymbolRef>();

    for (const symbol of moduleRef.symbols) {
      all.set(symbol.name, symbol);
      if (symbol.exported) {
        exported.set(symbol.name, symbol);
      }
    }

    byPath.set(moduleRef.path, all);
    exportedByPath.set(moduleRef.path, exported);
  }

  return { byPath, exportedByPath };
}

export function resolveExportedSymbol(
  index: SymbolIndex,
  targetPath: string,
  name: string,
): SymbolRef | null {
  return index.exportedByPath.get(targetPath)?.get(name) ?? null;
}
