import fs from "node:fs";
import path from "node:path";

import { brand, pc } from "@/ui/colors";
import { renderNoticeBox } from "@/ui/notify";

import { getConfigDir } from "./config";

type UpdateCache = {
  lastChecked: number;
  latestVersion: string;
};

function getCachePath(): string {
  return path.join(getConfigDir(), "update-check.json");
}

function isNewerVersion(current: string, latest: string): boolean {
  const cParts = current.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const lParts = latest.split(".").map((n) => Number.parseInt(n, 10) || 0);

  for (let i = 0; i < 3; i++) {
    const c = cParts[i] ?? 0;
    const l = lParts[i] ?? 0;
    if (l > c) {
      return true;
    }
    if (l < c) {
      return false;
    }
  }
  return false;
}

export async function checkCliUpdate(currentVersion: string): Promise<void> {
  if (process.argv.includes("--json") || !process.stdout.isTTY) {
    return;
  }

  const cachePath = getCachePath();
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  try {
    if (fs.existsSync(cachePath)) {
      const cache: UpdateCache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      if (now - cache.lastChecked < ONE_DAY_MS) {
        if (isNewerVersion(currentVersion, cache.latestVersion)) {
          printUpdateBanner(currentVersion, cache.latestVersion);
        }
        return;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch("https://registry.npmjs.org/@doxynix/cli/latest", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as { version?: string };
      const latest = data.version;
      if (latest) {
        fs.mkdirSync(path.dirname(cachePath), { recursive: true });
        fs.writeFileSync(
          cachePath,
          JSON.stringify({ lastChecked: now, latestVersion: latest }),
          "utf-8",
        );

        if (isNewerVersion(currentVersion, latest)) {
          printUpdateBanner(currentVersion, latest);
        }
      }
    }
  } catch {
    // Network issues during update checks should never interrupt CLI operation
  }
}

function printUpdateBanner(current: string, latest: string): void {
  const box = renderNoticeBox(
    "UPDATE AVAILABLE",
    [
      `${pc.gray("Current:")} ${pc.yellow(current)}  →  ${pc.gray("Latest:")} ${brand.success(latest)}`,
      brand.muted("Run: ") +
        brand.highlight("npm install -g @doxynix/cli") +
        brand.muted(" to update"),
    ],
    "warning",
  );
  console.error(box);
}
