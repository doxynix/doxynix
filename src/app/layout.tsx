import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import NextTopLoader from "nextjs-toploader";

import "./globals.css";

import { ReactNode, Suspense } from "react";
import { connection } from "next/server";
import { extractRouterConfig } from "uploadthing/server";

import { cn } from "@/shared/lib/utils";
import { ConsoleEasterEgg } from "@/shared/ui/ConsoleEasterEgg";
import { Toaster } from "@/shared/ui/sonner";
import { ourFileRouter } from "@/app/api/uploadthing/core";
import { Providers } from "@/app/providers";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL! ?? "https://doxynix.space"),

  title: {
    template: "%s | Doxynix",
    default: "Doxynix",
  },
  description:
    "Automated repository analysis, code metrics, and documentation generation in one click.",

  keywords: ["code analysis", "documentation generator", "metrics", "github analysis", "doxynix"],

  authors: [{ name: "Kramarich", url: "https://github.com/Kramarich0" }],
  creator: "Doxynix Team",

  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://doxynix.space",
    siteName: "Doxynix",
    title: "Doxynix — Code Analysis & Documentation",
    description: "Turn your code into clear analytics and documentation.",
  },

  twitter: {
    card: "summary_large_image",
    title: "Doxynix — Code Analysis",
    description: "Metrics and documentation for your projects.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html className="h-full" lang="ru" suppressHydrationWarning>
      <body
        className={cn("flex h-full flex-col", fontSans.variable, fontMono.variable, "antialiased")}
      >
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
        <Analytics />
        <SpeedInsights />
        <ConsoleEasterEgg />
      </body>
    </html>
  );
}
