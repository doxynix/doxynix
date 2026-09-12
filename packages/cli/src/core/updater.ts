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

export function checkCliUpdate(currentVersion: string): void {
  if (process.argv.includes("--json") || !process.stdout.isTTY) {
    return;
  }

  const cachePath = getCachePath();
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  try {
    if (fs.existsSync(cachePath)) {
      const cache: UpdateCache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      if (isNewerVersion(currentVersion, cache.latestVersion)) {
        printUpdateBanner(currentVersion, cache.latestVersion);
      }
      if (now - cache.lastChecked < ONE_DAY_MS) {
        return;
      }
    }
  } catch {
    // Ignored cache read error
  }

  fetch("https://registry.npmjs.org/@doxynix/cli/latest", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(1500),
  })
    .then(async (res) => {
      if (res.ok) {
        const data = (await res.json()) as { version?: string };
        if (data.version) {
          fs.mkdirSync(path.dirname(cachePath), { recursive: true });
          fs.writeFileSync(
            cachePath,
            JSON.stringify({ lastChecked: now, latestVersion: data.version }),
            "utf-8",
          );
        }
      }
    })
    .catch(() => {
      // Network errors must not interrupt operations
    });
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
