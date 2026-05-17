import { ADAPTER_PRIORITIES } from "../core/scoring-constants";
import { collectRegexSignals } from "../extractors/regex-signals";
import type { LanguageAdapter } from "./types";

export const regexAdapter: LanguageAdapter = {
  id: "regex-fallback",
  parse: (file) => collectRegexSignals(file),
  priority: ADAPTER_PRIORITIES.regex,
  supportedExtensions: [],
};
