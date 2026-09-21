import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { VercelToolbar } from "@vercel/toolbar/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import NextTopLoader from "nextjs-toploader";

import "../globals.css";

import { APP_URL } from "@/shared/config/env.client";
import { IS_ANALYZE, IS_DEV, IS_PROD } from "@/shared/config/env.flags";
import { DEFAULT_LOCALE, LOCALES } from "@/shared/config/locales";
import { routing } from "@/shared/i18n/routing";
import { cn } from "@/shared/lib/cn";
import { getSitemapUrl } from "@/shared/lib/sitemap.utils";
import { Toaster } from "@/shared/ui/core/sonner";
import { A11yProvider } from "@/shared/ui/kit/a11y-provider";
import { ConsoleEasterEgg } from "@/shared/ui/kit/console-easter-egg";
import { SkipLink } from "@/shared/ui/kit/skip-link";

import { Providers } from "../composition-root";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const fontSans = Geist({
  display: "swap",
  subsets: ["latin", "cyrillic", "latin-ext"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  display: "swap",
  subsets: ["latin", "cyrillic", "latin-ext"],
  variable: "--font-mono",
});

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { color: "#f7f7f8", media: "(prefers-color-scheme: light)" },
    { color: "#111318", media: "(prefers-color-scheme: dark)" },
  ],
  userScalable: true,
  width: "device-width",
};

const OG_LOCALE_MAP: Record<string, string> = {
  de: "de_DE",
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  it: "it_IT",
  ja: "ja_JP",
  ko: "ko_KR",
  pl: "pl_PL",
  "pt-BR": "pt_BR",
  ru: "ru_RU",
  tr: "tr_TR",
  "zh-CN": "zh_CN",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("Metadata");

  const languageAlternates: Record<string, string> = {};
  LOCALES.forEach((loc) => {
    languageAlternates[loc] = getSitemapUrl(APP_URL, "", loc, DEFAULT_LOCALE);
  });
  languageAlternates["x-default"] = getSitemapUrl(APP_URL, "", DEFAULT_LOCALE, DEFAULT_LOCALE);

  const currentCanonicalUrl = getSitemapUrl(APP_URL, "", locale, DEFAULT_LOCALE);

  const title = t("landing_title");
  const description = t("landing_desc");

  return {
    alternates: {
      canonical: currentCanonicalUrl,
      languages: languageAlternates,
    },

    authors: [{ name: "Kramarich", url: "https://github.com/Kramarich0" }],
    creator: "Doxynix Team",
    description,

    keywords: [
      "code analysis",
      "documentation generator",
      "architecture map",
      "metrics",
      "static analysis",
      "ast parsing",
      "github analysis",
      "doxynix",
      "technical debt",
      "bus factor",
      "developer tools",
    ],

    metadataBase: new URL(APP_URL),

    openGraph: {
      description,
      locale: OG_LOCALE_MAP[locale] ?? "en_US",
      siteName: "Doxynix",
      title,
      type: "website",
      url: currentCanonicalUrl,
    },

    robots: {
      follow: true,
      googleBot: {
        follow: true,
        index: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
      index: true,
    },

    title: {
      default: `Doxynix — ${title}`,
      template: "%s | Doxynix",
    },

    twitter: {
      card: "summary_large_image",
      creator: "@doxynix",
      description,
      title: `Doxynix — ${title}`,
    },
  };
}

export default async function LocaleLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      data-scroll-behavior="smooth"
      lang={locale}
      suppressHydrationWarning
    >
      <body
        className={cn(
          "flex min-h-dvh flex-col",
          fontSans.variable,
          fontMono.variable,
          "antialiased",
        )}
      >
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
        >
          <A11yProvider>
            <SkipLink />
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              disableTransitionOnChange
              enableSystem
              storageKey="doxynix-theme"
            >
              <Toaster
                duration={4000}
                gap={8}
                position="top-center"
              />
              <NextTopLoader
                color="var(--foreground)"
                showSpinner={false}
                zIndex={9999}
              />
              <Providers>{children}</Providers>
              {IS_PROD && (
                <>
                  <Analytics />
                  <SpeedInsights />
                </>
              )}
              {IS_DEV && !IS_ANALYZE && <VercelToolbar />}
              <ConsoleEasterEgg />
            </ThemeProvider>
          </A11yProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
