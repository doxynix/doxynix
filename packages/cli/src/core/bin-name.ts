import { basename } from "pathe";

const DEFAULT_BIN_NAME = "dxnx";
const LEGACY_BIN_NAME = "doxynix";

export function resolveBinName(argv: string[]): string {
  const scriptPath = argv[1];

  if (scriptPath == null) {
    return DEFAULT_BIN_NAME;
  }

  // Match the invoked file's own name, never a parent directory: an npm install path always
  // contains `@doxynix`.
  const invoked = basename(scriptPath).replace(/\.(js|cjs|mjs|ts)$/, "");

  return invoked === LEGACY_BIN_NAME ? LEGACY_BIN_NAME : DEFAULT_BIN_NAME;
}
