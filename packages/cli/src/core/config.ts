import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type DxnxConfig = {
  token?: string;
  apiUrl?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "dxnx");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "dxnx");
  }
  return path.join(os.homedir(), ".config", "dxnx");
}

function getConfigFilePath(): string {
  return path.join(getConfigDir(), "config.json");
}

function ensureConfigDirExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { mode: 0o700, recursive: true });
  }
}

let sessionToken: string | null = null;

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function getToken(): string | null {
  if (sessionToken) {
    return sessionToken;
  }
  if (process.env.DOXYNIX_API_KEY) {
    return process.env.DOXYNIX_API_KEY;
  }
  if (process.env.DXNX_TOKEN) {
    return process.env.DXNX_TOKEN;
  }

  const config = readConfig();
  return config.token ?? null;
}

export function saveToken(token: string): void {
  const current = readConfig();
  const next: DxnxConfig = { ...current, token };
  const targetFile = getConfigFilePath();

  ensureConfigDirExists(path.dirname(targetFile));
  fs.writeFileSync(targetFile, JSON.stringify(next, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });

  try {
    fs.chmodSync(targetFile, 0o600);
  } catch {
    // Ignore on file systems that do not support POSIX permissions (Windows FAT/NTFS)
  }
}

export function removeToken(): void {
  const current = readConfig();
  delete current.token;
  setSessionToken(null);

  const targetFile = getConfigFilePath();

  const remainingKeys = Object.entries(current).filter(([, val]) => val !== undefined);

  if (remainingKeys.length === 0) {
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
    }
  } else {
    const cleanConfig = Object.fromEntries(remainingKeys);
    ensureConfigDirExists(path.dirname(targetFile));
    fs.writeFileSync(targetFile, JSON.stringify(cleanConfig, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
    try {
      fs.chmodSync(targetFile, 0o600);
    } catch {
      // Ignore on Windows
    }
  }
}

const defaultApiUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000/api"
    : "https://doxynix.space/api";

export function getApiUrl(): string {
  let rawUrl: string;

  if (process.env.DOXYNIX_API_URL) {
    rawUrl = process.env.DOXYNIX_API_URL;
  } else {
    const config = readConfig();
    rawUrl = config.apiUrl ?? defaultApiUrl;
  }

  let cleanUrl = rawUrl.trim();
  while (cleanUrl.endsWith("/")) {
    cleanUrl = cleanUrl.slice(0, -1);
  }
  return cleanUrl;
}

function readConfig(): DxnxConfig {
  const targetFile = getConfigFilePath();

  if (!fs.existsSync(targetFile)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(targetFile, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) {
      const config: DxnxConfig = {};
      if (typeof parsed.apiUrl === "string") {
        config.apiUrl = parsed.apiUrl;
      }
      if (typeof parsed.token === "string") {
        config.token = parsed.token;
      }
      return config;
    }
    return {};
  } catch {
    return {};
  }
}
