import { brand, pc } from "@/ui/colors";
import { createTable } from "@/ui/table";

import { type LinkedAccountItem, type UserSessionItem } from "./profile.types";

export function renderSessionsTable(sessions: UserSessionItem[]): string {
  const table = createTable(["Client / User Agent", "IP Address", "Created At"]);
  for (const sess of sessions) {
    table.push([
      brand.highlight(sess.userAgent || "Unknown Device"),
      brand.info(sess.ipAddress || "—"),
      brand.muted(new Date(sess.createdAt).toLocaleString()),
    ]);
  }
  return table.toString();
}

export function renderLinkedAccountsTable(accounts: LinkedAccountItem[]): string {
  const table = createTable(["Provider", "Account Name", "Email"]);
  for (const acc of accounts) {
    table.push([
      pc.cyan(pc.bold(acc.provider.toUpperCase())),
      brand.highlight(acc.name ?? "—"),
      brand.muted(acc.email ?? "—"),
    ]);
  }
  return table.toString();
}
