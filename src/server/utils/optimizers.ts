import { isBinaryFile } from "isbinaryfile";

type AiTextLike = {
  text?: unknown;
  content?: unknown;
  output?: unknown;
};

function isAiTextLike(v: unknown): v is AiTextLike {
  if (!(v instanceof Object) || Array.isArray(v)) return false;

  if (v instanceof Date || v instanceof RegExp) return false;

  const obj = v as Record<string, unknown>;
  return obj.text != null || obj.content != null || obj.output != null;
}

const REMOVED_MSG = "/* ...content truncated... */";

export const CodeOptimizer = {
  optimize(code: string, fileName: string): string {
    let processed = code;

    processed = this.removeLicenseHeaders(processed);

    processed = this.redactSecrets(processed);

    processed = this.truncateLargeLiterals(processed);

    if (!fileName.includes("config") && !fileName.endsWith(".json")) {
      processed = this.truncateLargeDataStructures(processed);
    }

    return this.basicClean(processed);
  },

  basicClean(code: string): string {
    return code
      .replace(/^\s*[\r\n]/gm, "")
      .replace(/[ \t]+$/gm, "")
      .trim();
  },

  removeLicenseHeaders(code: string): string {
    return code.replace(/^\s*\/\*[\s\S]*?(?:license|copyright)[\s\S]*?\*\//i, "");
  },

  redactSecrets(code: string): string {
    return code
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "<REDACTED_EMAIL>")
      .replace(
        /(?<!\d)(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?!\d)/g,
        "<REDACTED_IP>"
      )
      .replace(
        /(['"])(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})(['"])/g,
        "$1<REDACTED_JWT>$3"
      );
  },

  truncateLargeLiterals(code: string): string {
    let newCode = code.replace(/(d\s*=\s*["'])([\s\S]{150,})(["'])/g, `$1${REMOVED_MSG}$3`);

    newCode = newCode.replace(/(['"]data:[^;]+;base64,)([^'"]{50,})(['"])/g, `$1${REMOVED_MSG}$3`);

    return newCode;
  },

  truncateLargeDataStructures(code: string): string {
    return code.replace(/\[\s*([\d\s,.-]{500,})\s*\]/g, `[ /* large data array truncated */ ]`);
  },
};

export function cleanCodeForAi(code: string, fileName: string = "unknown"): string {
  return CodeOptimizer.optimize(code, fileName);
}

export function unwrapAiText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (isAiTextLike(value)) {
    const candidate = value.text ?? value.content ?? value.output;
    return typeof candidate === "string" ? candidate : JSON.stringify(value);
  }
  if (Array.isArray(value)) return value.join("\n");
  return String(value);
}

export async function isBinary(buffer: Buffer): Promise<boolean> {
  return await isBinaryFile(buffer);
}
