import { collectRegexSignals } from "../extractors/regex-signals";
import type { LanguageAdapter } from "./types";

export const regexAdapter: LanguageAdapter = {
  id: "regex-fallback",
  parse: (file) => collectRegexSignals(file),
  priority: 100,
  supportedExtensions: [],
};
