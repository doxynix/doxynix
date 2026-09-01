import pc from "picocolors";

export { pc };

export const brand = {
  error: (text: string) => pc.red(text),
  highlight: (text: string) => pc.bold(pc.white(text)),
  info: (text: string) => pc.cyan(text),
  logo: (text: string) => pc.bold(pc.magenta(text)),
  muted: (text: string) => pc.gray(text),
  success: (text: string) => pc.green(text),
  warning: (text: string) => pc.yellow(text),
};
