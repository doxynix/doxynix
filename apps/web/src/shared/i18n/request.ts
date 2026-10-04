import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

// Loaded at runtime by the next-intl plugin through `requestConfig` in next.config.ts, never
// by a static import. Listed in knip.json's ignore so it is not mistaken for dead code.
export default getRequestConfig(async ({ locale }) => {
  let finalLocale: string = locale ?? "";

  if (finalLocale.trim() === "") {
    const paramValue = await rootParams.locale();

    if (hasLocale(routing.locales, paramValue)) {
      finalLocale = paramValue;
    } else {
      notFound();
    }
  }

  if (!hasLocale(routing.locales, finalLocale)) {
    notFound();
  }

  const messages = await import(`../../../messages/${finalLocale}.json`);

  return {
    locale: finalLocale,
    messages: messages.default,
  };
});
