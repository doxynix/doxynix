import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ProxyAgent, RequestInit } from "undici";

import { IS_PROD } from "@/shared/config/env.flags";
import {
  CF_ACCOUNT_ID,
  CF_GATEWAY_ID,
  CF_GATEWAY_TOKEN,
  GEMINI_PROXY,
  GOOGLE_GENERATIVE_AI_API_KEY,
} from "@/shared/config/env.server";

const proxyUrl = !IS_PROD ? GEMINI_PROXY : undefined;

let proxyAgentPromise: Promise<ProxyAgent> | null = null;

function getProxyAgent(uri: string): Promise<ProxyAgent> {
  proxyAgentPromise ??= import("undici").then(({ ProxyAgent }) => new ProxyAgent({ uri }));

  return proxyAgentPromise;
}

export const google = createGoogleGenerativeAI({
  apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
  baseURL: `https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${CF_GATEWAY_ID}/google-ai-studio/v1beta`,

  // Irreducible: undici's `Response` and the DOM `Response` the AI SDK declares are structurally incompatible, so the bridge between them has to stay a cast.
  fetch:
    proxyUrl == null
      ? undefined
      : async (url, options) => {
          const [{ fetch: undiciFetch }, dispatcher] = await Promise.all([
            import("undici"),
            getProxyAgent(proxyUrl),
          ]);
          const undiciOptions: RequestInit = {
            ...(options as Record<string, unknown>),
            dispatcher,
          };
          return undiciFetch(url.toString(), undiciOptions) as unknown as Promise<Response>;
        },

  headers: { "cf-aig-authorization": `Bearer ${CF_GATEWAY_TOKEN}` },
});
