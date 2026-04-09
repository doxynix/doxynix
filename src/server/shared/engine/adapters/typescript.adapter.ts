import { collectTypeScriptSignals } from "../extractors/typescript-signals";
import type { LanguageAdapter } from "./types";

export const typeScriptAdapter: LanguageAdapter = {
  detect: (file) =>
    [".cts", ".cjs", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"].some((ext) =>
      file.path.toLowerCase().endsWith(ext)
    ),
  id: "typescript-native",
  parse: (file) => collectTypeScriptSignals(file),
  priority: 300,
  supportedExtensions: [".cts", ".cjs", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"],
};
