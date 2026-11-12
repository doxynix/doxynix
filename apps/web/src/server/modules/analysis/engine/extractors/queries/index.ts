import type { LanguageQuerySpec } from "./types";
import { typescriptQuerySpec } from "./typescript";

export const QUERY_SPECS: Partial<Record<string, LanguageQuerySpec>> = {
  ".cts": typescriptQuerySpec,
  ".mts": typescriptQuerySpec,
  ".ts": typescriptQuerySpec,
  ".tsx": typescriptQuerySpec,
};
