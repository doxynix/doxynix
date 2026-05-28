import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ProxyAgent, fetch as undiciFetch, type RequestInit } from "undici";

import { GEMINI_PROXY } from "@/shared/constants/env.server";

const proxyAgent = GEMINI_PROXY != null ? new ProxyAgent({ uri: GEMINI_PROXY }) : undefined;

/**
 * Полностью настроенный ИИ-клиент Google.
 * Автоматически маршрутизирует трафик через локальный VPN-туннель при разработке.
 */
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,

  fetch: (url, options) => {
    const undiciOptions: RequestInit = {
      ...(options as Record<string, any>),
      dispatcher: proxyAgent,
    };

    return undiciFetch(url.toString(), undiciOptions) as unknown as Promise<Response>;
  },
});
