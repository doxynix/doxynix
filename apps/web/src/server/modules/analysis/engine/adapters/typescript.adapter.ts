import { ADAPTER_PRIORITIES } from "../core/scoring-constants";
import { collectTypeScriptSignals } from "../extractors/typescript-signals";
import type { LanguageAdapter } from "./types";

export const typeScriptAdapter: LanguageAdapter = {
  detect: (file) =>
    [".cts", ".cjs", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"].some((ext) =>
      file.path.toLowerCase().endsWith(ext)
    ),
  id: "typescript-native",
  parse: (file) => collectTypeScriptSignals(file),
  priority: ADAPTER_PRIORITIES.typescript,
  supportedExtensions: [".cts", ".cjs", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"],
};
