import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getApiUrl,
  getConfigDir,
  getToken,
  removeToken,
  saveToken,
  setSessionToken,
} from "./config";

let tempHome: string;
let previousXdg: string | undefined;
let previousApiKey: string | undefined;
let previousDnxToken: string | undefined;
let previousNodeEnv: string | undefined;

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
    return;
  }

  (process.env as Record<string, string | undefined>)[name] = value;
}

function unsetEnv(name: "DOXYNIX_API_KEY" | "DXNX_TOKEN" | "NODE_ENV"): void {
  setEnv(name, undefined);
}

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "dxnx-config-"));
  previousXdg = process.env.XDG_CONFIG_HOME;
  previousApiKey = process.env.DOXYNIX_API_KEY;
  previousDnxToken = process.env.DXNX_TOKEN;
  previousNodeEnv = process.env.NODE_ENV;

  setEnv("XDG_CONFIG_HOME", tempHome);
  unsetEnv("DOXYNIX_API_KEY");
  unsetEnv("DXNX_TOKEN");
  unsetEnv("NODE_ENV");
  setSessionToken(null);
});

afterEach(() => {
  if (previousXdg === undefined) {
    setEnv("XDG_CONFIG_HOME", undefined);
  } else {
    setEnv("XDG_CONFIG_HOME", previousXdg);
  }

  if (previousApiKey === undefined) {
    setEnv("DOXYNIX_API_KEY", undefined);
  } else {
    setEnv("DOXYNIX_API_KEY", previousApiKey);
  }

  if (previousDnxToken === undefined) {
    setEnv("DXNX_TOKEN", undefined);
  } else {
    setEnv("DXNX_TOKEN", previousDnxToken);
  }

  if (previousNodeEnv === undefined) {
    setEnv("NODE_ENV", undefined);
  } else {
    setEnv("NODE_ENV", previousNodeEnv);
  }

  setSessionToken(null);
  rmSync(tempHome, { force: true, recursive: true });
});

describe("config paths", () => {
  it("respects XDG_CONFIG_HOME for the config directory", () => {
    expect(getConfigDir()).toBe(join(tempHome, "dxnx"));
  });
});

describe("token storage", () => {
  it("persists a token in the configured config directory", () => {
    saveToken("abc-123");

    const configPath = join(tempHome, "dxnx", "config.json");
    expect(getToken()).toBe("abc-123");
    expect(JSON.parse(readFileSync(configPath, "utf-8")).token).toBe("abc-123");
  });

  it("prefers an explicit session token over persisted config", () => {
    saveToken("saved");
    setSessionToken("session");

    expect(getToken()).toBe("session");
  });

  it("obeys env token overrides before the config file", () => {
    saveToken("saved");
    process.env.DOXYNIX_API_KEY = "env-token";

    expect(getToken()).toBe("env-token");
  });

  it("removes the saved token from config and clears the session token", () => {
    saveToken("saved");
    setSessionToken("session");

    removeToken();

    expect(getToken()).toBeNull();
    const configPath = join(tempHome, "dxnx", "config.json");
    expect(existsSync(configPath)).toBe(false);
  });
});

describe("api url", () => {
  it("trims trailing slashes from the configured API URL", () => {
    const configDir = join(tempHome, "dxnx");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ apiUrl: "https://example.com/api/" }),
      "utf-8",
    );

    expect(getApiUrl()).toBe("https://example.com/api");
  });

  it("falls back to the default production URL when no config is set", () => {
    expect(getApiUrl()).toBe("https://doxynix.space/api");
  });
});
