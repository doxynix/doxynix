import { TREE_SITTER_SUPPORTED_EXTENSIONS } from "@/server/core/tree-sitter";

import { ADAPTER_PRIORITIES } from "../core/scoring-constants";
import { collectTreeSitterSignals } from "../extractors/tree-sitter-signals";
import type { LanguageAdapter } from "./types";

export const treeSitterAdapter: LanguageAdapter = {
  id: "tree-sitter",
  parse: (file) => collectTreeSitterSignals(file),
  priority: ADAPTER_PRIORITIES.treeSitter,
  supportedExtensions: TREE_SITTER_SUPPORTED_EXTENSIONS,
};
