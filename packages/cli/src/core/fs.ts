import fs from "node:fs";

import { dirname, resolve } from "pathe";

export type LocalFileError =
  | { reason: "directory" }
  | { reason: "missing" }
  | { reason: "read-failed" };

export type LocalFileResult = { content: string; ok: true } | { error: LocalFileError; ok: false };

export function readLocalFile(filePath: string): LocalFileResult {
  const localPath = resolve(process.cwd(), filePath);

  if (!fs.existsSync(localPath)) {
    return { error: { reason: "missing" }, ok: false };
  }

  if (!fs.statSync(localPath).isFile()) {
    return { error: { reason: "directory" }, ok: false };
  }

  try {
    return { content: fs.readFileSync(localPath, "utf-8"), ok: true };
  } catch {
    return { error: { reason: "read-failed" }, ok: false };
  }
}

export function readLocalFileIfExists(filePath: string): string | null {
  const result = readLocalFile(filePath);
  return result.ok ? result.content : null;
}

export function describeLocalFileError(filePath: string, error: LocalFileError): string {
  switch (error.reason) {
    case "directory": {
      return `Target path '${filePath}' is a directory, not a file.`;
    }
    case "missing": {
      return `File not found: '${filePath}'`;
    }
    case "read-failed": {
      return `Could not read file: '${filePath}'.`;
    }
  }
}

export function writeLocalFile(filePath: string, content: string): string {
  const targetPath = resolve(process.cwd(), filePath);
  fs.mkdirSync(dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf-8");
  return targetPath;
}
