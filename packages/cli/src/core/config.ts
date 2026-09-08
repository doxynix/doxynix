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

export function getToken(): string | null {
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
}

export function removeToken(): void {
  const current = readConfig();
  delete current.token;
  const targetFile = getConfigFilePath();

  if (Object.keys(current).length === 0) {
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
    }
  } else {
    ensureConfigDirExists(path.dirname(targetFile));
    fs.writeFileSync(targetFile, JSON.stringify(current, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
  }
}

const defaultApiUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000/api"
    : "https://doxynix.space/api";

export function getApiUrl(): string {
  if (process.env.DOXYNIX_API_URL) {
    return process.env.DOXYNIX_API_URL;
  }

  const config = readConfig();
  return config.apiUrl ?? defaultApiUrl;
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
      return {
        apiUrl: typeof parsed.apiUrl === "string" ? parsed.apiUrl : undefined,
        token: typeof parsed.token === "string" ? parsed.token : undefined,
      };
    }
    return {};
  } catch {
    return {};
  }
}
