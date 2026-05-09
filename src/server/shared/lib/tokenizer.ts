import { getEncoding } from "js-tiktoken";

import { appLogger } from "../infrastructure/app-logger";
import { hasText } from "./string-utils";

const encoding = getEncoding("o200k_base");

export async function countTokens(text: string): Promise<number> {
  if (!hasText(text)) return 0;

  try {
    const baseCount = encoding.encode(text).length;

    const safetyFactor = 1.2;

    return Math.ceil(baseCount * safetyFactor);
  } catch (error) {
    appLogger.error({ error, msg: "Tokenization failed, using fallback:" });
    return Math.ceil(text.length / 3);
  }
}
