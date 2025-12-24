import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import localFont from "next/font/local";

import { Providers } from "./providers";
import "./globals.css";

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
  variable: "--font-mono",
  display: "swap",
});

const monoItalic = localFont({
  src: "./fonts/IntelOneMono-LightItalic.woff2",
  variable: "--font-mono-italic",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Diploma App",
    default: "Diploma App",
  },
  description: "Diploma project",
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
        <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem>
          <Providers>
            <div className="relative">{children}</div>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
