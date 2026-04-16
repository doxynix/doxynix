import fs from "node:fs/promises";
import { attempt } from "es-toolkit";
import { join } from "pathe";

import { IS_DEV, IS_PROD } from "@/shared/constants/env.flags";

export async function dumpDebug(name: string, data: any, subfolder?: string) {
  if (IS_PROD || !IS_DEV) return;

  const targetDir = join(process.cwd(), ".debug", subfolder ?? "");

  const mkdirResult = attempt(() => fs.mkdir(targetDir, { recursive: true }));
  if (mkdirResult instanceof Error) return;

  const fileName = `${name}.json`;
  const filePath = join(targetDir, fileName);

  void attempt(() => fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8"));
}
