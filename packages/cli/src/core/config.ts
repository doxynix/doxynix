import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG_FILE = path.join(os.homedir(), ".dxnxconfig");

export interface DxnxConfig {
  token?: string;
  apiUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export function removeToken(): void {
  const current = readConfig();
  delete current.token;

  if (Object.keys(current).length === 0) {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
  } else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(current, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
  }
}

export function getApiUrl(): string {
  if (process.env.DOXYNIX_API_URL) {
    return process.env.DOXYNIX_API_URL;
  }
  const config = readConfig();
  return config.apiUrl ?? "http://localhost:3000/api";
}

function readConfig(): DxnxConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
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
