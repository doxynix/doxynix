/* eslint-disable sonarjs/slow-regex */
/* eslint-disable sonarjs/regex-complexity */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { compact, isString } from "es-toolkit";
import ts from "typescript";

import {
  getRuntime,
  getSpecByExt,
  loadLanguage,
  TREE_SITTER_SUPPORTED_EXTENSIONS,
} from "../engine/extractors/tree-sitter-signals";
import { getFileExtension } from "./path-operations";

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

    if ([".cts", ".js", ".jsx", ".mts", ".ts", ".tsx"].includes(ext)) {
      processed = this.skeletonizeTS(processed, fileName);
    } else if (TREE_SITTER_SUPPORTED_EXTENSIONS.includes(ext)) {
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
        "<REDACTED_IP>"
      )
      .replaceAll(/(["'])eyJ(?:[\w-]*\.){2}[\w-]*(["'])/g, "$1<REDACTED_JWT>$2");
  },

  removeLicenseHeaders(code: string): string {
    return code.replace(/^\s*\/\*[\S\s]*?(?:license|copyright)[\S\s]*?\*\//i, "");
  },

  /**
   * ПОЛИГЛОТ скелетонизация через Tree-Sitter
   */
  async skeletonizePolyglot(code: string, fileName: string): Promise<string> {
    const ext = getFileExtension(fileName);
    const spec = getSpecByExt(ext);
    if (!spec) return code.slice(0, 5000);

    let tree: any = null;
    let parser: any = null;

    try {
      const Parser = await getRuntime();
      parser = new Parser();

      const lang = await loadLanguage(ext, spec);
      parser.setLanguage(lang);

      tree = parser.parse(code);
      const root = tree.rootNode;

      const bodyNodeTypes = new Set(["block", "compound_statement", "do_block", "function_body"]);
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
      console.error("Polyglot skeletonizer error:", error);
      return code.slice(0, 5000);
    } finally {
      tree?.delete();
      parser?.delete();
    }
  },

  /**
   * Скелетонизация для TS/JS (через нативный TS AST)
   */
  skeletonizeTS(code: string, fileName: string): string {
    try {
      const sourceFile = ts.createSourceFile(
        fileName,
        code,
        ts.ScriptTarget.Latest,
        true,
        fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      const printer = ts.createPrinter({ removeComments: false });

      const transformer = <T extends ts.Node>(context: ts.TransformationContext) => {
        return (rootNode: T) => {
          const visit = (node: ts.Node): ts.Node => {
            if (
              ts.isFunctionDeclaration(node) ||
              ts.isMethodDeclaration(node) ||
              ts.isArrowFunction(node) ||
              ts.isFunctionExpression(node)
            ) {
              const body = node.body;
              if (body && body.getText().length > 50) {
                const comment = " /* ... implementation hidden ... */ ";

                if (!ts.isBlock(body) && ts.isArrowFunction(node)) {
                  return ts.factory.updateArrowFunction(
                    node,
                    node.modifiers,
                    node.typeParameters,
                    node.parameters,
                    node.type,
                    node.equalsGreaterThanToken,
                    ts.factory.createIdentifier(`null as any ${comment}`)
                  );
                }

                const stubBlock = ts.factory.createBlock([
                  ts.factory.createExpressionStatement(ts.factory.createIdentifier(comment)),
                ]);

                const factory = ts.factory as any;
                if (ts.isFunctionDeclaration(node)) {
                  return factory.updateFunctionDeclaration(
                    node,
                    node.modifiers,
                    node.asteriskToken,
                    node.name,
                    node.typeParameters,
                    node.parameters,
                    node.type,
                    stubBlock
                  );
                }
                if (ts.isMethodDeclaration(node)) {
                  return factory.updateMethodDeclaration(
                    node,
                    node.modifiers,
                    node.asteriskToken,
                    node.name,
                    node.questionToken,
                    node.typeParameters,
                    node.parameters,
                    node.type,
                    stubBlock
                  );
                }
                if (ts.isFunctionExpression(node)) {
                  return factory.updateFunctionExpression(
                    node,
                    node.modifiers,
                    node.asteriskToken,
                    node.name,
                    node.typeParameters,
                    node.parameters,
                    node.type,
                    stubBlock
                  );
                }
              }
            }
            return ts.visitEachChild(node, visit, context);
          };
          return ts.visitNode(rootNode, visit);
        };
      };

      const result = ts.transform(sourceFile, [transformer]);
      return printer.printFile(result.transformed[0] as ts.SourceFile);
    } catch {
      return code.slice(0, 5000);
    }
  },

  truncateLargeDataStructures(code: string): string {
    return code.replaceAll(/\[\s*([\d\s,.-]{500,})\s*]/g, `[ /* large data array truncated */ ]`);
  },

  truncateLargeLiterals(code: string): string {
    let newCode = code.replaceAll(/(d\s*=\s*["'])([^"']{150,})(["'])/g, `$1${REMOVED_MSG}$3`);
    newCode = newCode.replaceAll(
      /(["']data:[^;]+;base64,)([^"']{50,})(["'])/g,
      `$1${REMOVED_MSG}$3`
    );
    return newCode;
  },
};

export async function cleanCodeForAi(code: string, fileName: string = "unknown"): Promise<string> {
  return await CodeOptimizer.optimize(code, fileName);
}

export function unwrapAiText(value: unknown): string {
  if (value == null) return "";
  if (isString(value)) return value;

  if (Array.isArray(value)) {
    return compact(value.map((v) => unwrapAiText(v))).join("\n");
  }

  if (isAiTextLike(value)) {
    const candidate = value.text ?? value.content ?? value.output;
    return isString(candidate) ? candidate : JSON.stringify(candidate);
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return String(value);
}

export function skeletonizeCode(code: string): string {
  return code.replaceAll(/({[\S\s]*?})/gm, (match) => {
    if (match.length > 100) return "{ /* ... implementation hidden ... */ }";
    return match;
  });
}
