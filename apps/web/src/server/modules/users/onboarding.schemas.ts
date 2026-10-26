import { OnboardingIntentSchema, StatusSchema } from "@doxynix/shared";
import * as z from "zod";

export const OnboardingStepSchema = z.enum(["welcome", "github", "repo"]);

export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;

export const OnboardingStateSchema = z.object({
  activatedAt: z.coerce.date().nullable(),
  checklistDismissedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  firstRepo: z
    .object({
      id: z.uuid(),
      name: z.string(),
      owner: z.string(),
    })
    .nullable(),
  hasCompletedAnalysis: z.boolean(),
  hasGithubAccount: z.boolean(),
  hasGithubInstallation: z.boolean(),
  intent: z.nullable(OnboardingIntentSchema),
  latestAnalysis: z
    .object({
      id: z.uuid(),
      progress: z.number().int().min(0).max(100),
      status: StatusSchema,
    })
    .nullable(),
  repoCount: z.number().int().min(0),
  step: OnboardingStepSchema,
});

export type OnboardingState = z.infer<typeof OnboardingStateSchema>;
