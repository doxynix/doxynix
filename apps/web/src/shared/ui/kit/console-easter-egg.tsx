"use client";

import { useEffect } from "react";

function getThemeValue(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function ConsoleEasterEgg() {
  useEffect(() => {
    const titleStyle = [
      `color: ${getThemeValue("--foreground", "oklch(0.955 0.003 255)")}`,
      `background: ${getThemeValue("--surface-contrast", "oklch(0.205 0.01 264)")}`,
      "font-size: 14px",
      "font-weight: bold",
      "padding: 5px 10px",
      "border-radius: 6px",
      `border: 1px solid ${getThemeValue("--border", "oklch(0.29 0.01 264)")}`,
    ].join(";");

    const textStyle = [
      `color: ${getThemeValue("--muted-foreground", "oklch(0.69 0.01 258)")}`,
      "font-size: 12px",
      "line-height: 1.5",
      "padding-top: 5px",
    ].join(";");

    console.info("%c👋 Welcome to Doxynix, colleague!", titleStyle);

    console.info(
      "%cWe see you like to look under the hood. \nDoxynix was created by developers for developers.\n\nLike the project? Have any ideas? \nWrite to us: hello@doxynix.space",
      textStyle
    );

    const asciiStyle = `color: ${getThemeValue("--foreground", "oklch(0.955 0.003 255)")}; font-weight: bold; font-family: monospace;`;

    const asciiArt = `
    ██████╗  ██████╗ ██╗  ██╗██╗   ██╗███╗   ██╗██╗██╗  ██╗
    ██╔══██╗██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝████╗  ██║██║╚██╗██╔╝
    ██║  ██║██║   ██║ ╚███╔╝  ╚████╔╝ ██╔██╗ ██║██║ ╚███╔╝
    ██║  ██║██║   ██║ ██╔██╗   ╚██╔╝  ██║╚██╗██║██║ ██╔██╗
    ██████╔╝╚██████╔╝██╔╝ ██╗   ██║   ██║ ╚████║██║██╔╝ ██╗
    ╚═════╝  ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝
    `;

    console.info(`%c${asciiArt}`, asciiStyle);
  }, []);

  return null;
}
