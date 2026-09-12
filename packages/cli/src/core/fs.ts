import fs from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";

import { brand } from "@/ui/colors";

export type ReadFileOrPromptOptions = {
  cancelMessage?: string;
  message?: string;
  validateMessage?: string;
};

export async function readFileOrPrompt(filePath: string): Promise<string | null> {
  const localPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(localPath)) {
    p.outro(brand.error(`File not found: '${filePath}'`));
    return null;
  }

  if (!fs.statSync(localPath).isFile()) {
    p.outro(brand.error(`Target path '${filePath}' is a directory, not a file.`));
    return null;
  }

  return fs.readFileSync(localPath, "utf-8");
}

export function readLocalFileIfExists(filePath: string): string | null {
  const localPath = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
    return fs.readFileSync(localPath, "utf-8");
  }
  return null;
}

export function writeLocalFile(filePath: string, content: string): string {
  const targetPath = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf-8");
  return targetPath;
}
