import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type AbstractIntlMessages, createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import enMessages from "../../../messages/en.json";
import ruMessages from "../../../messages/ru.json";
import { AUTH_EMAIL_KEYS, AuthEmail } from "./auth-email";

// `AbstractIntlMessages` rather than `typeof enMessages`: the en JSON import infers *literal* string types, which would reject `ru` (key parity is enforced by check-locales.ts).
function translatorFor(locale: "en" | "ru", messages: AbstractIntlMessages) {
  return createTranslator({ locale, messages, namespace: "Auth" });
}

function renderAuthEmail(t: Parameters<typeof AuthEmail>[0]["t"]) {
  return renderToStaticMarkup(
    createElement(AuthEmail, {
      host: "app.doxynix.space",
      t,
      url: "https://app.doxynix.space/api/auth/magic-link/verify?token=abc",
    }),
  );
}

describe("AuthEmail", () => {
  it("declares the eight keys the template renders", () => {
    expect(AUTH_EMAIL_KEYS).toHaveLength(8);
  });

  it("renders every declared key into the template", () => {
    const html = renderAuthEmail((key) => `t:${key}`);

    for (const key of AUTH_EMAIL_KEYS) {
      expect(html).toContain(`t:${key}`);
    }
  });
});

describe("AuthEmail localization", () => {
  it("renders the Russian copy when handed a Russian translator", () => {
    const html = renderAuthEmail(translatorFor("ru", ruMessages));

    expect(html).toContain("Подтвердить вход");
    expect(html).toContain("Войти");
    expect(html).not.toContain("Confirm Sign In");
  });

  it("renders the English copy when handed an English translator", () => {
    const html = renderAuthEmail(translatorFor("en", enMessages));

    expect(html).toContain("Confirm Sign In");
    expect(html).toContain("Log in");
    expect(html).not.toContain("Подтвердить вход");
  });
});
