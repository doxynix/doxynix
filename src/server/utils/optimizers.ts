/* eslint-disable sonarjs/slow-regex */
/* eslint-disable sonarjs/regex-complexity */
import { isBinaryFile } from "isbinaryfile";

type AiTextLike = {
  content?: unknown;
  output?: unknown;
  text?: unknown;
};

function isAiTextLike(v: unknown): v is AiTextLike {
  if (!(v instanceof Object) || Array.isArray(v)) return false;

  if (v instanceof Date || v instanceof RegExp) return false;

  const obj = v as Record<string, unknown>;
  return obj.text != null || obj.content != null || obj.output != null;
}

const REMOVED_MSG = "/* ...content truncated... */";

export const CodeOptimizer = {
  basicClean(code: string): string {
    return code
      .replaceAll(/^\s*[\r\n]/gm, "")
      .replaceAll(/[ \t]+$/gm, "")
      .trim();
  },

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

  redactSecrets(code: string): string {
    return code
      .replaceAll(/[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, "<REDACTED_EMAIL>")
      .replaceAll(
        /(?<!\d)(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?!\d)/g,
        "<REDACTED_IP>"
      )
      .replaceAll(/(['"])eyJ[\w-]*\.[\w-]*\.[\w-]*(['"])/g, "$1<REDACTED_JWT>$2");
  },

  removeLicenseHeaders(code: string): string {
    return code.replace(/^\s*\/\*[\s\S]*?(?:license|copyright)[\s\S]*?\*\//i, "");
  },

  truncateLargeDataStructures(code: string): string {
    return code.replaceAll(/\[\s*([\d\s,.-]{500,})\s*\]/g, `[ /* large data array truncated */ ]`);
  },

  truncateLargeLiterals(code: string): string {
    let newCode = code.replaceAll(/(d\s*=\s*["'])([^"']{150,})(["'])/g, `$1${REMOVED_MSG}$3`);

    newCode = newCode.replaceAll(
      /(['"]data:[^;]+;base64,)([^'"]{50,})(['"])/g,
      `$1${REMOVED_MSG}$3`
    );

    return newCode;
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
  if (typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return value.join("\n");
  return String(value);
}

export async function isBinary(buffer: Buffer): Promise<boolean> {
  return await isBinaryFile(buffer);
}
