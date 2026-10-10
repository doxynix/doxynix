import { describe, expect, it, vi } from "vitest";

import {
  formatNotificationType,
  renderNotificationDetails,
  renderNotificationStatsTable,
  renderNotificationsTable,
} from "./notifications.formatter";

describe("notifications formatter", () => {
  it("formats notification badges by type", () => {
    expect(formatNotificationType("ERROR")).toContain("ERROR");
    expect(formatNotificationType("WARNING")).toContain("WARN");
    expect(formatNotificationType("SUCCESS")).toContain("OK");
    expect(formatNotificationType("INFO")).toContain("INFO");
  });

  it("renders notifications in a table", () => {
    const output = renderNotificationsTable([
      {
        createdAt: "2024-01-01T00:00:00.000Z",
        id: "notification-123",
        isRead: false,
        repo: { name: "platform", owner: "acme" },
        title: "Build failed",
        type: "ERROR",
      },
    ] as any);

    expect(output).toContain("ID");
    expect(output).toContain("Build failed");
    expect(output).toContain("acme/platform");
  });

  it("renders detail notice box and stats table", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    renderNotificationDetails({
      body: "The deploy pipeline failed.",
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "notification-123",
      isRead: false,
      repo: { name: "platform", owner: "acme" },
      title: "Build failed",
      type: "ERROR",
    } as any);

    const stats = renderNotificationStatsTable({ read: 1, total: 3, unread: 2 });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toContain("Build failed");
    expect(stats).toContain("Unread");
    expect(stats).toContain("3");

    logSpy.mockRestore();
  });
});
