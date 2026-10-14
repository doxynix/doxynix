import { FixStatusSchema, PaginationMetaSchema, PRAnalysisStatusSchema } from "@doxynix/shared";
import * as z from "zod";

import {
  DateRangeSchema,
  dateRangeMustBeOrdered,
  PaginationSchema,
} from "@/server/utils/pagination";

const ID_SCHEMA = z.uuid();
const RISK_MIN = 0;
const RISK_MAX = 10;

export const AdminReviewFilterSchema = PaginationSchema.extend({
  fixStatus: z.optional(FixStatusSchema),
  minRiskScore: z.coerce.number().int().min(RISK_MIN).max(RISK_MAX).optional(),
  status: z.optional(PRAnalysisStatusSchema),
  ...DateRangeSchema.shape,
}).superRefine(dateRangeMustBeOrdered);

export type AdminReviewFilterInput = z.infer<typeof AdminReviewFilterSchema>;

export const AdminReviewRefSchema = z.object({ id: ID_SCHEMA });

export type AdminReviewRefInput = z.infer<typeof AdminReviewRefSchema>;

export const AdminReviewFixSchema = z.object({
  branch: z.string(),
  createdAt: z.date(),
  estimatedImpact: z.number().int().min(0).max(100).nullable(),
  githubPrNumber: z.number().int().nullable(),
  githubPrUrl: z.string().nullable(),
  id: z.uuid(),
  status: FixStatusSchema,
  title: z.string(),
});

export const AdminReviewSummarySchema = z.object({
  createdAt: z.date(),
  fixCount: z.number().int().min(0),
  id: z.uuid(),
  owner: z.string(),
  prNumber: z.number().int(),
  repoName: z.string(),
  riskScore: z.number().int().min(0).max(10).nullable(),
  status: PRAnalysisStatusSchema,
  updatedAt: z.date(),
});

export const AdminReviewDetailSchema = AdminReviewSummarySchema.extend({
  baseSha: z.string(),
  error: z.string().nullable(),
  fixes: z.array(AdminReviewFixSchema),
  headSha: z.string(),
  repoId: z.uuid(),
});

export const AdminReviewListSchema = z.object({
  items: z.array(AdminReviewSummarySchema),
  meta: PaginationMetaSchema,
});
