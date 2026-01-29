import { ReactNode, Suspense } from "react";
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

import { APP_URL, isProd } from "@/shared/constants/env";
import { Locale } from "@/shared/constants/locales";
import { cn } from "@/shared/lib/utils";
import { Toaster } from "@/shared/ui/core/sonner";
import { ConsoleEasterEgg } from "@/shared/ui/kit/console-easter-egg";
import { ourFileRouter } from "@/app/api/uploadthing/core";
import { Providers } from "@/app/providers";

import { routing } from "@/i18n/routing";

async function UTSSR() {
  await connection();
  return <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />;
}

const fontSans = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  alternates: {
    canonical: "./",
  },

  title: {
    template: "%s | Doxynix",
    default: "Doxynix - AI Code Analysis & Documentation Generator",
  },

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

  authors: [{ name: "Kramarich", url: "https://github.com/Kramarich0" }],
  creator: "Doxynix Team",

  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "Doxynix",
    title: "Doxynix: Turn Legacy Code into Clear Documentation",
    description:
      "Automate your engineering documentation. Get instant architecture maps, bus factor analysis, and onboarding guides for your repositories.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Doxynix Dashboard Preview",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Doxynix - AI Powered Code Documentation",
    description:
      "Generate comprehensive documentation and code metrics in one click. Perfect for managing technical debt and onboarding new developers.",
    creator: "@doxynix",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
    <html lang={locale} suppressHydrationWarning>
      <body
        className={cn(
          "flex min-h-dvh flex-col",
          fontSans.variable,
          fontMono.variable,
          "antialiased"
        )}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <NextTopLoader color="#ffffff" showSpinner={false} zIndex={9999} />
          <Suspense>
            <UTSSR />
          </Suspense>
          <Providers>
            {children}
            <Toaster
              theme="dark" // THEME: пока так будет форс
              position="top-center"
              richColors
              duration={4000}
              gap={8}
            />
          </Providers>
          {isProd && (
            <>
              <Analytics />
              <SpeedInsights />
            </>
          )}
          <ConsoleEasterEgg />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
