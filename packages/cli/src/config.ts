import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG_PATH = path.join(os.homedir(), ".dxnxconfig");

/**
 * Безопасно сохраняет API-ключ в файл с правами доступа 0o600
 */
export function saveToken(token: string): void {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ token }, null, 2), {
        mode: 0o600,
    });
}

/**
 * Извлекает локально сохраненный API-ключ
 */
export function getToken(): string | null {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
        return config.token || null;
    } catch {
        return null;
    }
}

/**
 * Удаляет файл конфигурации при выходе из системы
 */
export function removeToken(): void {
    if (fs.existsSync(CONFIG_PATH)) {
        fs.unlinkSync(CONFIG_PATH);
    }
}