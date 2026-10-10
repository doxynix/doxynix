import { describe, expect, it, vi } from "vitest";

import { MESSAGES } from "./messages";
import { output } from "./output";

describe("output", () => {
  it("writes JSON when json mode is enabled", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const handled = output.json({ ok: true }, true);

    expect(handled).toBe(true);
    expect(write).toHaveBeenCalledWith('{\n  "ok": true\n}\n');
  });

  it("returns false without writing when json mode is off", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    expect(output.json({ ok: true }, false)).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it("writes to stderr and stdout helpers", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    output.stderr("err");
    output.write("log");

    expect(stderr).toHaveBeenCalledWith("err\n");
    expect(stdout).toHaveBeenCalledWith("log\n");
  });
});

describe("MESSAGES", () => {
  it("contains the user-facing CLI copy for repo and notification actions", () => {
    expect(MESSAGES.notification.deleted).toBe("Notification deleted");
    expect(MESSAGES.repo.deletedAll).toBe("All repositories have been deleted");
    expect(MESSAGES.notificationBulk.deletedRead(3)).toBe("Deleted 3 read notifications");
    expect(MESSAGES.notificationBulk.markedAll(2)).toBe("Marked 2 notifications as read");
  });
});
