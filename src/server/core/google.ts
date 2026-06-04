import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ProxyAgent, fetch as undiciFetch, type RequestInit } from "undici";

import { IS_PROD } from "@/shared/constants/env.flags";
import {
  CF_ACCOUNT_ID,
  CF_GATEWAY_ID,
  CF_GATEWAY_TOKEN,
  GEMINI_PROXY,
  GOOGLE_GENERATIVE_AI_API_KEY,
} from "@/shared/constants/env.server";

const proxyAgent =
  !IS_PROD && GEMINI_PROXY != null ? new ProxyAgent({ uri: GEMINI_PROXY }) : undefined;

export const google = createGoogleGenerativeAI({
  apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
  baseURL: `https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${CF_GATEWAY_ID}/google-ai-studio/v1beta`,

  fetch:
    proxyAgent != null
      ? (url, options) => {
          const undiciOptions: RequestInit = {
            ...(options as Record<string, any>),
            dispatcher: proxyAgent,
          };
          return undiciFetch(url.toString(), undiciOptions) as unknown as Promise<Response>;
        }
      : undefined,

  headers: { "cf-aig-authorization": `Bearer ${CF_GATEWAY_TOKEN}` },
});
