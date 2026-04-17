import fs from "node:fs/promises";
import { attempt } from "es-toolkit";
import { join } from "pathe";

import { IS_PROD } from "@/shared/constants/env.flags";

export async function dumpDebug<T>(name: string, data: T, subfolder?: string) {
  if (IS_PROD) return;

  const targetDir = join(process.cwd(), ".debug", subfolder ?? "");

  const mkdirResult = attempt(() => fs.mkdir(targetDir, { recursive: true }));
  if (mkdirResult instanceof Error) return;

  const fileName = `${name}.json`;
  const filePath = join(targetDir, fileName);

  void attempt(() => fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8"));
}
