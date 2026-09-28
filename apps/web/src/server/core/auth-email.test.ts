import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AUTH_EMAIL_KEYS, AuthEmail } from "./auth-email";

describe("AuthEmail", () => {
  it("exposes exactly the eight keys the Auth namespace defines", () => {
    expect(AUTH_EMAIL_KEYS).toHaveLength(8);
  });

  it("renders every declared key into the template", () => {
    const html = renderToStaticMarkup(
      createElement(AuthEmail, {
        host: "doxynix.com",
        t: (key) => `t:${key}`,
        url: "https://doxynix.space/callback",
      }),
    );

    for (const key of AUTH_EMAIL_KEYS) {
      expect(html).toContain(`t:${key}`);
    }
  });
});
