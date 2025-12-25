import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "./globals.css";

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

export const metadata: Metadata = {
  title: {
    template: "Doxynix | %s",
    default: "App",
  },
  description: "Doxynix",
  icons: [{ url: "/favicon.ico", type: "image/x-icon" }],
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
          <main className="relative">
            {children} <Analytics /> <SpeedInsights />
          </main>
        </Providers>
      </body>
    </html>
  );
}
