import { StatusSchema } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";
import * as z from "zod";

export const analysisLatestSelect = {
  complexityScore: true,
  id: true,
  jobId: true,
  message: true,
  onboardingScore: true,
  progress: true,
  score: true,
  securityScore: true,
  status: true,
  techDebtScore: true,
  updatedAt: true,
} satisfies Prisma.AnalysisSelect;

export const AnalysisLatestOutputSchema = z
  .strictObject({
    complexityScore: z.number().int().nullable(),
    id: z.uuid(),
    jobId: z.string().nullable(),
    message: z.string().nullable(),
    onboardingScore: z.number().int().nullable(),
    progress: z.number().int(),
    publicAccessToken: z.string().nullable(),
    score: z.number().int().nullable(),
    securityScore: z.number().int().nullable(),
    status: StatusSchema,
    techDebtScore: z.number().int().nullable(),
    updatedAt: z.date(),
  })
  .nullable();

export type AnalysisLatestOutput = z.infer<typeof AnalysisLatestOutputSchema>;
