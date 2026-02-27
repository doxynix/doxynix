import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cn,
  formatFullDate,
  formatRelativeTime,
  getCookieName,
  getInitials,
  getLanguageColor,
  isGitHubUrl,
  normalizeLanguageName,
  sanitizePayload,
  smoothScrollTo,
} from "@/shared/lib/utils";

describe("shared/lib/utils:getInitials", () => {
  it("should return initials for names with two or more words", () => {
    const fullName = "Ada Lovelace Byron";

    const result = getInitials(fullName);

    expect(result).toBe("AL");
  });

  it("should return one letter for a single-word name", () => {
    const name = "Cher";

    const result = getInitials(name);

    expect(result).toBe("C");
  });

  it("should trim extra spaces in name before extracting initials", () => {
    const name = "   Alan    Turing   ";

    const result = getInitials(name);

    expect(result).toBe("AT");
  });

  it("should support non-latin names", () => {
    const name = "Иван Петров";

    const result = getInitials(name);

    expect(result).toBe("ИП");
  });

  it("should fallback to email initial when name is null or undefined", () => {
    const email = "user@example.com";

    const fromNull = getInitials(null, email);
    const fromUndefined = getInitials(undefined, email);

    expect(fromNull).toBe("U");
    expect(fromUndefined).toBe("U");
  });

  it("should return U when both name and email are missing", () => {
    const name = null;
    const email = undefined;

    const result = getInitials(name, email);

    expect(result).toBe("U");
  });
});

describe("shared/lib/utils:isGitHubUrl", () => {
  it("should return true for valid github URLs and short owner/repo paths", () => {
    const validInputs = [
      "https://github.com/facebook/react",
      // eslint-disable-next-line sonarjs/no-clear-text-protocols
      "http://github.com/vercel/next.js",
      "owner/repo",
      "/owner/repo",
      "https://gist.github.com/user/123",
    ];

    const results = validInputs.map((input) => isGitHubUrl(input));

    expect(results).toEqual([true, true, true, true, true]);
  });

  it("should return false for invalid or non-github inputs", () => {
    const invalidInputs = [
      "",
      "just-string",
      "https://google.com/repo",
      "https://githubx.com/owner/repo",
      // eslint-disable-next-line sonarjs/no-clear-text-protocols
      "ftp://github.com/owner/repo",
    ];

    const results = invalidInputs.map((input) => isGitHubUrl(input));

    expect(results).toEqual([false, false, false, false, false]);
  });

  it("should return true for ssh-style github remote", () => {
    expect(isGitHubUrl("git@github.com:owner/repo.git")).toBe(true);
  });

  it("should return false for malformed absolute URL", () => {
    expect(isGitHubUrl("https://[::1")).toBe(false);
  });
});

describe("shared/lib/utils:formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return default value for null and invalid dates", () => {
    const defaultValue = "N/A";

    const fromNull = formatRelativeTime(null, "en", defaultValue);
    const fromInvalid = formatRelativeTime("not-a-date", "en", defaultValue);

    expect(fromNull).toBe(defaultValue);
    expect(fromInvalid).toBe(defaultValue);
  });

  it("should return localized relative time for supported locales", () => {
    const date = new Date("2026-02-26T12:00:00.000Z");

    const enResult = formatRelativeTime(date, "en");
    const ruResult = formatRelativeTime(date, "ru");
    const deResult = formatRelativeTime(date, "de");

    expect(enResult).not.toBe("—");
    expect(ruResult).not.toBe("—");
    expect(deResult).not.toBe("—");
  });
});

describe("shared/lib/utils:cn", () => {
  it("should merge classes and keep last tailwind conflict", () => {
    const className = cn("p-2", "text-sm", "p-4", "bg-blue-500");

    expect(className).toContain("p-4");
    expect(className).toContain("bg-blue-500");
    expect(className).not.toContain("p-2");
  });
});

describe("shared/lib/utils:formatFullDate", () => {
  it("should format date to readable string with locale", () => {
    const formatted = formatFullDate("2026-01-02T03:04:00.000Z", "en");

    expect(formatted).toContain("2026");
    expect(formatted).toMatch(/,\s\d{2}:\d{2}$/);
  });
});

describe("shared/lib/utils:getCookieName", () => {
  it("should return cookie name for current runtime", () => {
    const cookieName = getCookieName();

    expect(["__Secure-next-auth.session-token", "next-auth.session-token"]).toContain(cookieName);
  });
});

describe("shared/lib/utils:getLanguageColor", () => {
  it("should return fallback color for null and unknown language", () => {
    expect(getLanguageColor(null)).toBe("#cccccc");
    expect(getLanguageColor("VeryUnknownLanguage")).toBe("#cccccc");
  });

  it("should resolve color by exact name, extension and case-insensitive name", () => {
    expect(getLanguageColor("TypeScript")).toBe("#2b7489");
    expect(getLanguageColor("ts")).toBe("#2b7489");
    expect(getLanguageColor("typescript")).toBe("#2b7489");
  });
});

describe("shared/lib/utils:normalizeLanguageName", () => {
  it("should normalize known extension and uppercase unknown one", () => {
    expect(normalizeLanguageName("ts")).toBe("TypeScript");
    expect(normalizeLanguageName("abc")).toBe("ABC");
  });
});

describe("shared/lib/utils:smoothScrollTo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should warn and stop when element is not found", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.stubGlobal("document", {
      getElementById: vi.fn(() => null),
    });

    smoothScrollTo("missing-element");

    expect(warnSpy).toHaveBeenCalledWith("Element with id #missing-element not found");
    warnSpy.mockRestore();
  });

  it("should call scrollTo when target element exists", () => {
    const element = {
      getBoundingClientRect: vi.fn(() => ({ top: 300 })),
    };
    const scrollTo = vi.fn();
    let currentTime = 0;

    vi.stubGlobal("document", {
      getElementById: vi.fn(() => element),
    });
    vi.stubGlobal("window", {
      pageYOffset: 100,
      scrollTo,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: (time: number) => void) => {
      currentTime += 400;
      callback(currentTime);
      return 1;
    });

    smoothScrollTo("target", 80, 800);

    expect(scrollTo).toHaveBeenCalled();
  });
});

describe("shared/lib/utils:sanitizePayload", () => {
  const SENSITIVE_FIELDS = [
    "password",
    "newPassword",
    "passwordHash",
    "hash",
    "salt",
    "token",
    "sessionToken",
    "verificationToken",
    "identifier",
    "access_token",
    "refresh_token",
    "id_token",
    "hashedKey",
    "secret",
    "clientSecret",
    "cvv",
    "creditCard",
    "iban",
  ] as const;

  it("should redact all sensitive fields on root level", () => {
    const input = Object.fromEntries(
      SENSITIVE_FIELDS.map((field) => [field, `${field}_value`])
    ) as Record<(typeof SENSITIVE_FIELDS)[number], string>;

    const result = sanitizePayload(input) as Record<(typeof SENSITIVE_FIELDS)[number], string>;

    for (const key of SENSITIVE_FIELDS) {
      expect(result[key]).toBe("***REDACTED***");
    }
  });

  it("should redact nested objects and arrays without mutating original value", () => {
    const input = {
      meta: { page: 1 },
      nested: {
        password: "p1",
        token: "t1",
      },
      users: [
        { access_token: "a1", login: "alice" },
        { login: "bob", refresh_token: "r1" },
      ],
    };

    const result = sanitizePayload(input) as {
      meta: { page: number };
      nested: { password: string; token: string };
      users: Array<{ access_token?: string; login: string; refresh_token?: string }>;
    };

    expect(result).toEqual({
      meta: { page: 1 },
      nested: {
        password: "***REDACTED***",
        token: "***REDACTED***",
      },
      users: [
        { access_token: "***REDACTED***", login: "alice" },
        { login: "bob", refresh_token: "***REDACTED***" },
      ],
    });
    expect(input.nested.password).toBe("p1");
    expect(input.users[0].access_token).toBe("a1");
  });
});
