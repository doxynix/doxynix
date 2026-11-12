import { goQuerySpec } from "./go";
import { javascriptQuerySpec } from "./javascript";
import { pythonQuerySpec } from "./python";
import { rustQuerySpec } from "./rust";
import type { LanguageQuerySpec } from "./types";
import { typescriptQuerySpec } from "./typescript";

export const QUERY_SPECS: Partial<Record<string, LanguageQuerySpec>> = {
  ".cjs": javascriptQuerySpec,
  ".cts": typescriptQuerySpec,
  ".go": goQuerySpec,
  ".js": javascriptQuerySpec,
  ".jsx": javascriptQuerySpec,
  ".mjs": javascriptQuerySpec,
  ".mts": typescriptQuerySpec,
  ".py": pythonQuerySpec,
  ".rs": rustQuerySpec,
  ".ts": typescriptQuerySpec,
  ".tsx": typescriptQuerySpec,
};
