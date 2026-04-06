import {
  collectTreeSitterSignals,
  TREE_SITTER_SUPPORTED_EXTENSIONS,
} from "../extractors/tree-sitter-signals";
import type { LanguageAdapter } from "./types";

export const treeSitterAdapter: LanguageAdapter = {
  id: "tree-sitter",
  parse: (file) => collectTreeSitterSignals(file),
  priority: 200,
  supportedExtensions: TREE_SITTER_SUPPORTED_EXTENSIONS,
};
