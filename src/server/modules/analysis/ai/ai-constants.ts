import { type google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { get } from "@vercel/edge-config";
import { z } from "zod";

import { GROQ_API_KEY } from "@/shared/constants/env.server";

import { appLogger } from "@/server/core/app-logger";

export const groq = createOpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

type GoogleModelId = Parameters<typeof google>[0];
type GroqModelId = Parameters<typeof groq>[0];
type AllAvailableModels = GoogleModelId | GroqModelId;

type AIModelRole =
  | "AGENT"
  | "ARCHITECT"
  | "CARTOGRAPHER"
  | "FALLBACK"
  | "POWERFUL"
  | "SENTINEL"
  | "WRITER";

export const DEFAULT_AI_MODELS: Record<AIModelRole, AllAvailableModels[]> = {
  AGENT: ["gemma-4-26b-a4b-it"],
  ARCHITECT: ["gemma-4-26b-a4b-it", "gemini-3.1-flash-lite"],
  CARTOGRAPHER: ["gemma-4-26b-a4b-it", "gemini-3.1-flash-lite"],
  FALLBACK: ["gemma-4-26b-a4b-it"],
  POWERFUL: ["gemma-4-26b-a4b-it", "gemini-3.1-flash-lite"],
  SENTINEL: ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"],
  WRITER: ["gemma-4-26b-a4b-it", "gemini-3.1-flash-lite"],
};

const aiModelsSchema = z.record(
  z.enum(["AGENT", "ARCHITECT", "CARTOGRAPHER", "FALLBACK", "POWERFUL", "SENTINEL", "WRITER"]),
  z.array(z.string())
);

/**
 * Функция динамического получения актуальной карты моделей.
 * Пытается прочитать Edge Config, в случае неудачи или неверного формата
 * безопасно возвращает дефолтный жестко зашитый конфиг.
 */
export async function getActiveModels(): Promise<Record<AIModelRole, AllAvailableModels[]>> {
  try {
    const remoteConfig = await get("AI_MODELS");

    if (remoteConfig == null) {
      return DEFAULT_AI_MODELS;
    }

    const parsed = aiModelsSchema.safeParse(remoteConfig);
    if (parsed.success) {
      return parsed.data as Record<AIModelRole, AllAvailableModels[]>;
    }

    appLogger.error({
      error: parsed.error,
      msg: "Dynamic AI_MODELS config from Edge Config has invalid format. Falling back to static default.",
    });
  } catch (error) {
    appLogger.warn({
      error,
      msg: "Vercel Edge Config is unavailable. Operating on static AI_MODELS fallback.",
    });
  }

  return DEFAULT_AI_MODELS;
}

type GoogleSafetySetting = NonNullable<GoogleLanguageModelOptions["safetySettings"]>[number];

export const SAFETY_SETTINGS: GoogleSafetySetting[] = [
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
];
