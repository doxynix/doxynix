/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";

import { IS_PROD } from "@/shared/constants/env.client";

export function dumpDebug(name: string, data: any, subfolder?: string) {
  if (IS_PROD) return;

  const baseDir = path.join(process.cwd(), ".debug");
  const targetDir = subfolder != null ? path.join(baseDir, subfolder) : baseDir;

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const fileName = `${name}.json`;
  fs.writeFileSync(path.join(targetDir, fileName), JSON.stringify(data, null, 2));
}
