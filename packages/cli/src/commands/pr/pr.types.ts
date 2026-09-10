import type { RouterInput, RouterOutput } from "@/core/client";

export type PRListItem = RouterOutput["analysis"]["listByRepository"][number];
export type FixItem = RouterOutput["analysis"]["getByRepository"][number];
export type FixDetails = RouterOutput["analysis"]["getById"];
export type PRCommentItem = RouterOutput["analysis"]["getComments"]["renderedComments"][number];

export type CreateFixInput = RouterInput["analysis"]["createFix"];
export type ApplyFixInput = RouterInput["analysis"]["applyFix"];
export type FindingForFix = CreateFixInput["findings"][number];
export type StagedFixedFile = ApplyFixInput["fixedFiles"][number];
export type OpenPullRequestInput = RouterInput["analysis"]["openPullRequest"];
export type PostCommentInput = RouterInput["analysis"]["postCommentToPR"];
export type GetByPRNumberInput = RouterInput["analysis"]["getByPRNumber"];
export type PRAnalysisDetails = RouterOutput["analysis"]["getAnalysis"];
export type PRImpactDetails = RouterOutput["analysis"]["getImpactByPRNumber"];

export type GetAnalysisInput = RouterInput["analysis"]["getAnalysis"];
export type GetImpactByPRNumberInput = RouterInput["analysis"]["getImpactByPRNumber"];
