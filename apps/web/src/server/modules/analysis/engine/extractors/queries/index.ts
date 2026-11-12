import { bashQuerySpec } from "./bash";
import { cQuerySpec } from "./c";
import { cppQuerySpec } from "./cpp";
import { csharpQuerySpec } from "./csharp";
import { goQuerySpec } from "./go";
import { javaQuerySpec } from "./java";
import { javascriptQuerySpec } from "./javascript";
import { luaQuerySpec } from "./lua";
import { objcQuerySpec } from "./objc";
import { phpQuerySpec } from "./php";
import { pythonQuerySpec } from "./python";
import { rustQuerySpec } from "./rust";
import { swiftQuerySpec } from "./swift";
import type { LanguageQuerySpec } from "./types";
import { typescriptQuerySpec } from "./typescript";

export const QUERY_SPECS: Partial<Record<string, LanguageQuerySpec>> = {
  ".c": cQuerySpec,
  ".cjs": javascriptQuerySpec,
  ".cpp": cppQuerySpec,
  ".cs": csharpQuerySpec,
  ".cts": typescriptQuerySpec,
  ".go": goQuerySpec,
  ".java": javaQuerySpec,
  ".js": javascriptQuerySpec,
  ".jsx": javascriptQuerySpec,
  ".lua": luaQuerySpec,
  ".m": objcQuerySpec,
  ".mjs": javascriptQuerySpec,
  ".mts": typescriptQuerySpec,
  ".php": phpQuerySpec,
  ".py": pythonQuerySpec,
  ".rs": rustQuerySpec,
  ".sh": bashQuerySpec,
  ".swift": swiftQuerySpec,
  ".ts": typescriptQuerySpec,
  ".tsx": typescriptQuerySpec,
};
