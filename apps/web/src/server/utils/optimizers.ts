/* eslint-disable sonarjs/regex-complexity */
/* eslint-disable sonarjs/slow-regex */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { compact, isString } from "es-toolkit";

import { appLogger } from "../core/app-logger";
import {
  getRuntime,
  getSpecByExt,
  loadLanguage,
  TREE_SITTER_SUPPORTED_EXTENSIONS,
} from "../modules/analysis/engine/extractors/tree-sitter-signals";
import { getFileExtension } from "./path-operations";

type AiTextLike = {
  content?: unknown;
  output?: unknown;
  text?: unknown;
};

function isAiTextLike(v: unknown): v is AiTextLike {
  if (!(v instanceof Object) || Array.isArray(v)) {
    return false;
  }

  if (v instanceof Date || v instanceof RegExp) {
    return false;
  }

  const obj = v as Record<string, unknown>;
  return obj.text != null || obj.content != null || obj.output != null;
}

const REMOVED_MSG = "/* ...content truncated... */";

export const CodeOptimizer = {
  basicClean(code: string): string {
    return code
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .join("\n")
      .trim();
  },

  async cleanForTool(code: string): Promise<string> {
    let processed = code;
    processed = this.removeLicenseHeaders(processed);
    processed = this.redactSecrets(processed);
    processed = this.truncateLargeLiterals(processed);
    return this.basicClean(processed);
  },

  async optimize(code: string, fileName: string): Promise<string> {
    let processed = code;
    const ext = getFileExtension(fileName);

    processed = this.removeLicenseHeaders(processed);
    processed = this.redactSecrets(processed);

    if (
      TREE_SITTER_SUPPORTED_EXTENSIONS.includes(ext) ||
      [".cts", ".js", ".jsx", ".mts", ".ts", ".tsx"].includes(ext)
    ) {
      processed = await this.skeletonizePolyglot(processed, fileName);
    } else {
      processed = processed.length > 5000 ? skeletonizeCode(processed).slice(0, 5000) : processed;
    }

    return this.basicClean(processed);
  },

  redactSecrets(code: string): string {
    return code
      .replaceAll(/[\w%+.-]+@[\w.-]+\.[A-Za-z]{2,}/g, "<REDACTED_EMAIL>")
      .replaceAll(
        /(?<!\d)(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?!\d)/g,
        "<REDACTED_IP>",
      )
      .replaceAll(/(["'])eyJ(?:[\w-]*\.){2}[\w-]*(["'])/g, "$1<REDACTED_JWT>$2");
  },

  removeLicenseHeaders(code: string): string {
    return code.replace(/^\s*\/\*[\S\s]*?(?:license|copyright)[\S\s]*?\*\//i, "");
  },

  /**
   * Полиглот-скелетонизация через Tree-Sitter (TypeScript, JavaScript, Go, Python, Rust, C#, и др.)
   */
  async skeletonizePolyglot(code: string, fileName: string): Promise<string> {
    const ext = getFileExtension(fileName);
    const spec = getSpecByExt(ext);
    if (spec == null) {
      return code.slice(0, 5000);
    }

    let tree: any = null;
    let parser: any = null;

    try {
      const Parser = await getRuntime();
      parser = new Parser();

      const lang = await loadLanguage(ext, spec);
      parser.setLanguage(lang);

      tree = parser.parse(code);
      const root = tree.rootNode;

      const bodyNodeTypes = new Set([
        "block",
        "compound_statement",
        "do_block",
        "function_body",
        "statement_block",
      ]);
      const rangesToReplace: Array<{ end: number; start: number }> = [];

      const findBodies = (node: any) => {
        if (bodyNodeTypes.has(node.type) && node.endIndex - node.startIndex > 60) {
          rangesToReplace.push({ end: node.endIndex, start: node.startIndex });
          return;
        }
        for (let i = 0; i < node.childCount; i++) {
          findBodies(node.child(i));
        }
      };

      findBodies(root);
      rangesToReplace.sort((a, b) => b.start - a.start);

      let result = code;
      for (const range of rangesToReplace) {
        const replacement = "{ /* ... implementation hidden ... */ }";
        result = result.slice(0, range.start) + replacement + result.slice(range.end);
      }

      tree.delete();
      parser.delete();
      return result;
    } catch (error) {
      appLogger.error({ error, msg: "Polyglot skeletonizer error:" });
      return code.slice(0, 5000);
    } finally {
      tree?.delete?.();
      parser?.delete?.();
    }
  },

  truncateLargeDataStructures(code: string): string {
    return code.replaceAll(/\[\s*([\d\s,.-]{500,})\s*]/g, `[ /* large data array truncated */ ]`);
  },

  truncateLargeLiterals(code: string): string {
    let newCode = code.replaceAll(/(d\s*=\s*["'])([^"']{150,})(["'])/g, `$1${REMOVED_MSG}$3`);
    newCode = newCode.replaceAll(
      /(["']data:[^;]+;base64,)([^"']{50,})(["'])/g,
      `$1${REMOVED_MSG}$3`,
    );
    return newCode;
  },
};

export function unwrapAiText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (isString(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return compact(value.map((v) => unwrapAiText(v))).join("\n");
  }

  if (isAiTextLike(value)) {
    const candidate = value.text ?? value.content ?? value.output;
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function skeletonizeCode(code: string): string {
  return code.replaceAll(/({[\S\s]*?})/gm, (match) => {
    if (match.length > 100) {
      return "{ /* ... implementation hidden ... */ }";
    }
    return match;
  });
}
