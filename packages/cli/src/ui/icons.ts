import pc from "picocolors";

const isUnicodeSupported = Boolean(
  process.platform !== "win32" ||
    process.env.WT_SESSION ||
    process.env.VSCODE_INJECTION ||
    process.env.TERM_PROGRAM ||
    process.env.CI ||
    process.env.TERM === "xterm-256color",
);

const glyphs = {
  ai: isUnicodeSupported ? "✦" : "*",
  arrowRight: isUnicodeSupported ? "→" : ">",
  branch: isUnicodeSupported ? "⎇" : "@",
  bullet: isUnicodeSupported ? "•" : "-",
  check: isUnicodeSupported ? "✔" : "√",
  cross: isUnicodeSupported ? "✖" : "x",
  doc: isUnicodeSupported ? "≡" : "=",
  dot: isUnicodeSupported ? "●" : "*",
  dotMuted: isUnicodeSupported ? "○" : "o",
  folder: isUnicodeSupported ? "■" : "#",
  info: isUnicodeSupported ? "ℹ" : "i",
  key: isUnicodeSupported ? "⚿" : "#",
  lock: isUnicodeSupported ? "■" : "x",
  package: isUnicodeSupported ? "■" : "#",
  pending: isUnicodeSupported ? "◌" : "...",
  pointer: isUnicodeSupported ? "›" : ">",
  security: isUnicodeSupported ? "◆" : "*",
  star: isUnicodeSupported ? "★" : "*",
  warning: isUnicodeSupported ? "▲" : "!",
};

export const icons = {
  ai: pc.magenta(glyphs.ai),
  branch: pc.magenta(glyphs.branch),
  bullet: pc.gray(glyphs.bullet),
  check: pc.green(glyphs.check),
  cross: pc.red(glyphs.cross),
  doc: pc.cyan(glyphs.doc),
  dot: pc.green(glyphs.dot),
  dotMuted: pc.gray(glyphs.dotMuted),
  dotWarning: pc.yellow(glyphs.dot),
  folder: pc.blue(glyphs.folder),
  info: pc.cyan(glyphs.info),
  key: pc.yellow(glyphs.key),
  lock: pc.yellow(glyphs.lock),
  package: pc.blue(glyphs.package),
  pending: pc.cyan(glyphs.pending),
  pr: pc.magenta(glyphs.branch),
  raw: glyphs,
  security: pc.cyan(glyphs.security),
  star: pc.yellow(glyphs.star),
  warning: pc.yellow(glyphs.warning),
};
