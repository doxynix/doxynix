import { brand } from "./colors";

const esc = "\\x1B";
const ANSI_REGEX = new RegExp(`${esc}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`, "g");

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

export function getStringWidth(text: string): number {
  const clean = stripAnsi(text);
  let width = 0;

  for (const char of clean) {
    const code = char.codePointAt(0) ?? 0;

    if (code === 0xfe_0e || code === 0xfe_0f) {
      continue;
    }

    if (
      (code >= 0x11_00 && code <= 0x11_5f) ||
      (code >= 0x23_29 && code <= 0x23_2a) ||
      (code >= 0x2e_80 && code <= 0xa4_cf && code !== 0x30_3f) ||
      (code >= 0xac_00 && code <= 0xd7_a3) ||
      (code >= 0xf9_00 && code <= 0xfa_ff) ||
      (code >= 0xfe_10 && code <= 0xfe_19) ||
      (code >= 0xfe_30 && code <= 0xfe_6f) ||
      (code >= 0xff_00 && code <= 0xff_60) ||
      (code >= 0xff_e0 && code <= 0xff_e6) ||
      (code >= 0x1_f0_00 && code <= 0x1_fa_ff) ||
      (code >= 0x2_00_00 && code <= 0x3_ff_fd)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }

  return width;
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return brand.muted("—");
  }
  if (score >= 80) {
    return brand.success(`${score}/100`);
  }
  if (score >= 50) {
    return brand.warning(`${score}/100`);
  }
  return brand.error(`${score}/100`);
}

export function getScoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return brand.muted("No data");
  }
  if (score >= 80) {
    return brand.success("Excellent");
  }
  if (score >= 50) {
    return brand.warning("Needs Attention");
  }
  return brand.error("Critical");
}

export function stripHtml(html: string): string {
  return html
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<\/div>/gi, "\n")
    .replaceAll(/<\/p>/gi, "\n")
    .replaceAll(/<\/span><span/gi, "</span> <span")
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#39;", "'")
    .trim();
}
