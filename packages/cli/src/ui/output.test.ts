import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("output.fail", () => {
  afterEach(() => {
    process.exitCode = 0;
  });

  it("sets a non-zero exit code and writes a JSON envelope in json mode", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });

    output.fail("Repository not found", { code: "NOT_FOUND", json: true });

    expect(process.exitCode).toBe(1);
    expect(JSON.parse(written.join(""))).toEqual({
      code: "NOT_FOUND",
      error: "Repository not found",
      success: false,
    });
  });

  it("defaults the envelope code to ERROR", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });

    output.fail("Nope", { json: true });

    expect(JSON.parse(written.join("")).code).toBe("ERROR");
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
