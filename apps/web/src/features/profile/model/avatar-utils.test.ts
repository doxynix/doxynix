import { describe, expect, it } from "vitest";

import { resolveAvatarUploadErrorKey, sanitizeAvatarBaseName } from "./avatar-utils";

describe("sanitizeAvatarBaseName", () => {
  it("lowercases and strips the extension", () => {
    expect(sanitizeAvatarBaseName("Photo.PNG")).toBe("photo");
  });

  it("replaces whitespace runs with dashes", () => {
    expect(sanitizeAvatarBaseName("My Avatar Photo.jpg")).toBe("my-avatar-photo");
  });

  it("strips only the final extension from multi-dot names", () => {
    expect(sanitizeAvatarBaseName("photo.v2.jpg")).toBe("photo.v2");
  });

  it("keeps digits, dots and underscores", () => {
    expect(sanitizeAvatarBaseName("Avatar.V2_final.jpeg")).toBe("avatar.v2_final");
  });

  it("removes non-ASCII characters entirely", () => {
    expect(sanitizeAvatarBaseName("фото.png")).toBe("");
  });

  it("removes non-ASCII characters across scripts", () => {
    for (const filename of ["фото.png", "图片.png", "صورة.png"]) {
      expect(sanitizeAvatarBaseName(filename)).toBe("");
    }
  });

  it("strips accents from Latin names", () => {
    expect(sanitizeAvatarBaseName("avÁtar.jpg")).toBe("avtar");
  });

  it("strips emoji from filenames", () => {
    expect(sanitizeAvatarBaseName("avatar😀.jpg")).toBe("avatar");
  });

  it("leaves only a dash when non-ASCII surrounds it", () => {
    expect(sanitizeAvatarBaseName("Фото (осень).png")).toBe("-");
  });
});

describe("resolveAvatarUploadErrorKey", () => {
  it("maps the real Vercel Blob size error to the too-large key", () => {
    expect(
      resolveAvatarUploadErrorKey(
        new Error("Body size of 6291456 bytes exceeds the maximum allowed size of 5242880 bytes"),
      ),
    ).toBe("settings_profile_file_too_large");
  });

  it("maps 'too large' phrasing to the too-large key", () => {
    expect(resolveAvatarUploadErrorKey(new Error("Upload too large"))).toBe(
      "settings_profile_file_too_large",
    );
  });

  it("maps the real Vercel Blob content-type error to the invalid-format key", () => {
    expect(
      resolveAvatarUploadErrorKey(new Error("Content type mismatch, file has an invalid type")),
    ).toBe("settings_profile_invalid_file_format");
  });

  it("matches patterns case-insensitively", () => {
    expect(resolveAvatarUploadErrorKey(new Error("UNAUTHORIZED request"))).toBe(
      "settings_profile_not_logged_in",
    );
  });

  it("picks the first matching pattern", () => {
    expect(resolveAvatarUploadErrorKey(new Error("too large upload, unauthorized"))).toBe(
      "settings_profile_file_too_large",
    );
  });

  it("falls back for unknown errors", () => {
    expect(resolveAvatarUploadErrorKey(new Error("network error"))).toBe(
      "settings_profile_error_uploading_file",
    );
  });

  it("handles non-Error throws via String(error)", () => {
    expect(resolveAvatarUploadErrorKey("500 Internal Server Error")).toBe(
      "settings_profile_error_uploading_file",
    );
  });
});
