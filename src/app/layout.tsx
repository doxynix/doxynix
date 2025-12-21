import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: "./fonts/Inter-Regular.woff2",
  variable: "--font-inter",
  display: "swap",
});

const interItalic = localFont({
  src: "./fonts/Inter-Italic.woff2",
  variable: "--font-inter-italic",
  display: "swap",
});

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
    <html lang="en">
      <body className={`${inter.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
