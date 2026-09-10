import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { getRequestConfig } from "next-intl/server";

import type { Locale } from "@/shared/constants/locales";

import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  let finalLocale: string = locale ?? "";

  if (finalLocale.trim() === "") {
    const paramValue = await rootParams.locale();

    if (routing.locales.includes(paramValue as Locale)) {
      finalLocale = paramValue;
    } else {
      notFound();
    }
  }

  if (!routing.locales.includes(finalLocale as Locale)) {
    notFound();
  }

  const messages = await import(`../../../messages/${finalLocale}.json`);

  return {
    locale: finalLocale,
    messages: messages.default,
  };
});
