import fs from "node:fs/promises";
import { attemptAsync } from "es-toolkit";
import { join } from "pathe";

import { IS_PROD } from "@/shared/constants/env.flags";

export async function dumpDebug<T>(name: string, data: T, subfolder?: string) {
  if (IS_PROD) return;

  const targetDir = join(process.cwd(), ".debug", subfolder ?? "");

  const [mkdirError] = await attemptAsync(() => fs.mkdir(targetDir, { recursive: true }));
  if (mkdirError != null) return;

  const filePath = join(targetDir, `${name}.json`);

  await attemptAsync(() => fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8"));
}
