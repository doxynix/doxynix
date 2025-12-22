import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: "./fonts/Inter-Regular.woff2",
  variable: "--font-inter",
  display: "swap",
});

const mono = localFont({
  src: "./fonts/IntelOneMono-Light.woff2",
  variable: "--font-mono",
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
      <body className={`${inter.variable} ${mono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem>
          <div className="relative min-h-screen">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
