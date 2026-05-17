// "gemini-3-pro-preview",
// "gemini-3-flash-preview",
// "gemini-2.5-pro",
// "gemini-2.5-flash",
// "gemini-2.5-flash-preview-09-2025",
// "gemini-2.5-flash-lite-preview-09-2025",
// "gemini-2.5-flash-lite",
// "gemini-2.0-flash-001",
// "gemini-2.0-flash-lite",
// "gemini-pro-latest",
// "gemini-flash-latest",
// "gemini-flash-lite-latest",
// "gemini-exp-1206",
// "gemma-3-27b-it",
// "gemma-3-12b-it",

import type { google, GoogleLanguageModelOptions } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

import { GROQ_API_KEY } from "@/shared/constants/env.server";

export const groq = createOpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

type GoogleModelId = Parameters<typeof google>[0];
type GroqModelId = Parameters<typeof groq>[0];

type AllAvailableModels = GoogleModelId | GroqModelId;

type AIModelRole = "ARCHITECT" | "CARTOGRAPHER" | "FALLBACK" | "POWERFUL" | "SENTINEL" | "WRITER";

export const AI_MODELS = {
  ARCHITECT: ["gemini-3.1-flash-lite-preview"],
  CARTOGRAPHER: ["gemini-3.1-flash-lite-preview"],
  FALLBACK: ["gemini-3.1-flash-lite-preview"],
  POWERFUL: ["gemini-3.1-flash-lite-preview"],
  SENTINEL: ["gemini-3.1-flash-lite-preview"],
  WRITER: ["gemini-3.1-flash-lite-preview"],
} satisfies Record<AIModelRole, AllAvailableModels[]>;

type GoogleSafetySetting = NonNullable<GoogleLanguageModelOptions["safetySettings"]>[number];

export const SAFETY_SETTINGS: GoogleSafetySetting[] = [
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
];
