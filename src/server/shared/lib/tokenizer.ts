import { getEncoding } from "js-tiktoken";

const encoding = getEncoding("o200k_base");

export async function countTokens(text: string): Promise<number> {
  if (!text || text.trim().length === 0) return 0;

  try {
    const baseCount = encoding.encode(text).length;

    const safetyFactor = 1.2;

    return Math.ceil(baseCount * safetyFactor);
  } catch (error) {
    console.error("Tokenization failed, using fallback:", error);
    return Math.ceil(text.length / 3);
  }
}
