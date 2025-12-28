import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "./globals.css";

import { Toaster } from "@/shared/ui/sonner";
import { Providers } from "@/app/providers";

// Интер
const interRegular = localFont({
  src: "./fonts/Inter-Regular.woff2",
  variable: "--font-inter-regular",
  display: "swap",
});

const interItalic = localFont({
  src: "./fonts/Inter-Italic.woff2",
  variable: "--font-inter-italic",
  display: "swap",
});

// Моно
const mono = localFont({
  src: "./fonts/IntelOneMono-Light.woff2",
  variable: "--font-mono-light",
  display: "swap",
});

const monoItalic = localFont({
  src: "./fonts/IntelOneMono-LightItalic.woff2",
  variable: "--font-mono-italic",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL! || "https://doxynix.space"),

  title: {
    template: "%s | Doxynix",
    default: "Doxynix",
  },
  description:
    "Автоматический анализ репозиториев, метрики качества кода и генерация документации в один клик.",

  keywords: ["code analysis", "documentation generator", "metrics", "github analysis", "doxynix"],

  authors: [{ name: "Doxynix Team", url: "https://doxynix.space" }],
  creator: "Doxynix",

  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://doxynix.space",
    siteName: "Doxynix",
    title: "Doxynix — Анализ кода и документация",
    description: "Превратите свой код в понятную аналитику и документацию.",
  },

  twitter: {
    card: "summary_large_image",
    title: "Doxynix — Анализ кода",
    description: "Метрики и документация для ваших проектов.",
    creator: "@doxynix",
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
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
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${interRegular.variable} ${interItalic.variable} ${mono.variable} ${monoItalic.variable} antialiased`}
      >
        <Providers>
          <main className="relative h-screen">{children}</main>
          <Toaster position="top-center" richColors duration={4000} gap={8} />
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
