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

import { createOpenAI } from "@ai-sdk/openai";

import { GROQ_API_KEY } from "@/shared/constants/env";

export const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: GROQ_API_KEY,
});

export const AI_MODELS = {
  CARTOGRAPHER: ["gemini-flash-latest", "gemini-flash-lite-latest"],
  ARCHITECT: ["gemini-3-flash-preview", "gemini-flash-latest"],
  SENTINEL: ["gemini-flash-latest"],
  POWERFUL: ["gemini-3-flash-preview", "gemini-2.5-flash-lite", "gemini-flash-latest"],
  WRITER: ["gemini-3-flash-preview", "gemini-2.5-flash-lite", "gemini-flash-latest"],
  FALLBACK: ["gemini-flash-latest"],
};

export const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
];
