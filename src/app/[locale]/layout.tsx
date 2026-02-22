import { Suspense, type ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import NextTopLoader from "nextjs-toploader";
import { extractRouterConfig } from "uploadthing/server";

import "../globals.css";

import { APP_URL, IS_PROD } from "@/shared/constants/env.client";
import type { Locale } from "@/shared/constants/locales";
import { cn } from "@/shared/lib/utils";
import { Toaster } from "@/shared/ui/core/sonner";
import { ConsoleEasterEgg } from "@/shared/ui/kit/console-easter-egg";
import { HotkeyListeners } from "@/shared/ui/kit/hotkey-listeners";
import { Providers } from "@/app/providers";

import { routing } from "@/i18n/routing";
import { ourFileRouter } from "@/server/lib/core";

async function UTSSR() {
  await connection();
  return <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />;
}

const fontSans = Inter({
  display: "swap",
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
});

const fontMono = JetBrains_Mono({
  display: "swap",
  subsets: ["latin", "cyrillic"],
  variable: "--font-mono",
});

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
  userScalable: true,
  width: "device-width",
};

export const metadata: Metadata = {
  alternates: {
    canonical: "./",
  },

  authors: [{ name: "Kramarich", url: "https://github.com/Kramarich0" }],

  creator: "Doxynix Team",

  description:
    "Stop writing docs manually. Doxynix analyzes your codebase to generate onboarding guides, architecture diagrams, and real-time complexity metrics instantly.",

  keywords: [
    "code analysis",
    "documentation generator",
    "metrics",
    "github analysis",
    "doxynix",
    "technical debt",
    "static analysis",
    "developer tools",
  ],

  metadataBase: new URL(APP_URL),
  openGraph: {
    description:
      "Automate your engineering documentation. Get instant architecture maps, bus factor analysis, and onboarding guides for your repositories.",
    images: [
      {
        alt: "Doxynix Dashboard Preview",
        height: 630,
        url: "/opengraph-image.png",
        width: 1200,
      },
    ],
    locale: "en_US",
    siteName: "Doxynix",
    title: "Doxynix: Turn Legacy Code into Clear Documentation",
    type: "website",
    url: APP_URL,
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
    default: "Doxynix - AI Code Analysis & Documentation Generator",
    template: "%s | Doxynix",
  },

  twitter: {
    card: "summary_large_image",
    creator: "@doxynix",
    description:
      "Generate comprehensive documentation and code metrics in one click. Perfect for managing technical debt and onboarding new developers.",
    title: "Doxynix - AI Powered Code Documentation",
  },
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html suppressHydrationWarning lang={locale}>
      <body
        className={cn(
          "flex min-h-dvh flex-col",
          fontSans.variable,
          fontMono.variable,
          "antialiased"
        )}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Toaster
            richColors
            duration={4000}
            gap={8}
            position="top-center"
            theme="dark" // THEME: пока так будет форс
          />
          <NextTopLoader color="#ffffff" showSpinner={false} zIndex={9999} />
          <Suspense>
            <UTSSR />
          </Suspense>
          <Providers>{children}</Providers>
          {IS_PROD && (
            <>
              <Analytics />
              <SpeedInsights />
            </>
          )}
          <ConsoleEasterEgg />
          <HotkeyListeners />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
