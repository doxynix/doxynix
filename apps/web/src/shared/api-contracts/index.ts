import { Prisma } from "@prisma/client";
import { z } from "zod";

/////////////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////

// JSON
//------------------------------------------------------

export type NullableJsonInput =
  | Prisma.JsonValue
  | null
  | "JsonNull"
  | "DbNull"
  | Prisma.NullTypes.DbNull
  | Prisma.NullTypes.JsonNull;

export const transformJsonNull = (v?: NullableJsonInput) => {
  if (!v || v === "DbNull") return Prisma.NullTypes.DbNull;
  if (v === "JsonNull") return Prisma.NullTypes.JsonNull;
  return v;
};

export const JsonValueSchema: z.ZodType<Prisma.JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.literal(null),
    z.record(
      z.string(),
      z.lazy(() => JsonValueSchema.optional()),
    ),
    z.array(z.lazy(() => JsonValueSchema)),
  ]),
);

export type JsonValueType = z.infer<typeof JsonValueSchema>;

export const NullableJsonValue = z
  .union([JsonValueSchema, z.literal("DbNull"), z.literal("JsonNull")])
  .nullable()
  .transform((v) => transformJsonNull(v));

export type NullableJsonValueType = z.infer<typeof NullableJsonValue>;

export const InputJsonValueSchema: z.ZodType<Prisma.InputJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.object({ toJSON: z.any() }),
    z.record(
      z.string(),
      z.lazy(() => z.union([InputJsonValueSchema, z.literal(null)])),
    ),
    z.array(z.lazy(() => z.union([InputJsonValueSchema, z.literal(null)]))),
  ]),
);

export type InputJsonValueType = z.infer<typeof InputJsonValueSchema>;

/////////////////////////////////////////
// ENUMS
/////////////////////////////////////////

export const TransactionIsolationLevelSchema = z.enum([
  "ReadUncommitted",
  "ReadCommitted",
  "RepeatableRead",
  "Serializable",
]);

export const UserScalarFieldEnumSchema = z.enum([
  "id",
  "publicId",
  "email",
  "emailHash",
  "name",
  "emailVerified",
  "image",
  "imageKey",
  "role",
  "banned",
  "banReason",
  "banExpires",
  "twoFactorEnabled",
  "lastLoginMethod",
  "createdAt",
  "updatedAt",
]);

export const RelationLoadStrategySchema = z.enum(["query", "join"]);

export const AccountScalarFieldEnumSchema = z.enum([
  "id",
  "publicId",
  "userId",
  "accountId",
  "providerId",
  "email",
  "emailHash",
  "image",
  "name",
  "refreshToken",
  "accessToken",
  "accessTokenExpiresAt",
  "refreshTokenExpiresAt",
  "tokenType",
  "scope",
  "idToken",
  "impersonatedBy",
  "createdAt",
  "updatedAt",
]);

export const PasskeyScalarFieldEnumSchema = z.enum([
  "id",
  "name",
  "publicKey",
  "userId",
  "credentialID",
  "counter",
  "deviceType",
  "backedUp",
  "transports",
  "aaguid",
  "createdAt",
  "updatedAt",
]);

export const TwoFactorScalarFieldEnumSchema = z.enum([
  "id",
  "secret",
  "backupCodes",
  "verified",
  "userId",
  "createdAt",
  "updatedAt",
]);

export const SessionScalarFieldEnumSchema = z.enum([
  "id",
  "publicId",
  "token",
  "tokenHash",
  "expiresAt",
  "ipAddress",
  "userAgent",
  "userId",
  "createdAt",
  "updatedAt",
]);

export const VerificationScalarFieldEnumSchema = z.enum([
  "id",
  "identifier",
  "identifierHash",
  "value",
  "valueHash",
  "expiresAt",
  "createdAt",
  "updatedAt",
]);

export const BannedEmailScalarFieldEnumSchema = z.enum([
  "id",
  "email",
  "emailHash",
  "reason",
  "createdAt",
  "updatedAt",
]);

export const RepoScalarFieldEnumSchema = z.enum([
  "id",
  "publicId",
  "githubId",
  "owner",
  "name",
  "description",
  "url",
  "language",
  "license",
  "topics",
  "stars",
  "forks",
  "defaultBranch",
  "ownerAvatarUrl",
  "openIssues",
  "size",
  "visibility",
  "pushedAt",
  "createdAt",
  "githubCreatedAt",
  "updatedAt",
  "userId",
]);

export const GithubInstallationScalarFieldEnumSchema = z.enum([
  "id",
  "appId",
  "targetId",
  "targetType",
  "accountLogin",
  "accountAvatar",
  "repositorySelection",
  "isSuspended",
  "htmlUrl",
  "createdAt",
  "updatedAt",
  "userId",
]);

export const AnalysisScalarFieldEnumSchema = z.enum([
  "id",
  "publicId",
  "status",
  "progress",
  "message",
  "score",
  "securityScore",
  "complexityScore",
  "techDebtScore",
  "onboardingScore",
  "metricsJson",
  "resultJson",
  "commitSha",
  "jobId",
  "logs",
  "error",
  "createdAt",
  "updatedAt",
  "repoId",
]);

export const DocumentScalarFieldEnumSchema = z.enum([
  "id",
  "publicId",
  "version",
  "type",
  "content",
  "path",
  "createdAt",
  "updatedAt",
  "repoId",
  "analysisId",
]);

export const PullRequestAnalysisScalarFieldEnumSchema = z.enum([
  "id",
  "publicId",
  "prNumber",
  "owner",
  "repoName",
  "headSha",
  "baseSha",
  "status",
  "riskScore",
  "findingsJson",
  "changedFilesJson",
  "jobId",
  "error",
  "createdAt",
  "updatedAt",
  "repoId",
]);

export const PullRequestAnalysisConfigScalarFieldEnumSchema = z.enum([
  "id",
  "publicId",
  "enabled",
  "ciSkip",
  "commentStyle",
  "tokenBudget",
  "focusAreas",
  "excludePatterns",
  "createdAt",
  "updatedAt",
  "repoId",
]);

export const PullRequestCommentScalarFieldEnumSchema = z.enum([
  "id",
  "publicId",
  "filePath",
  "line",
  "riskLevel",
  "body",
  "findingType",
  "githubCommentId",
  "createdAt",
  "updatedAt",
  "analysisId",
]);

export const GeneratedFixScalarFieldEnumSchema = z.enum([
  "id",
  "publicId",
  "title",
  "description",
  "branch",
  "status",
  "estimatedImpact",
  "githubPrUrl",
  "githubPrNumber",
  "createdAt",
  "updatedAt",
  "createdByUser",
  "repoId",
  "prAnalysisId",
]);

export const NotificationScalarFieldEnumSchema = z.enum([
  "id",
  "publicId",
  "title",
  "body",
  "type",
  "isRead",
  "createdAt",
  "updatedAt",
  "userId",
  "repoId",
]);

export const ApiKeyScalarFieldEnumSchema = z.enum([
  "id",
  "prefix",
  "hashedKey",
  "name",
  "description",
  "lastUsed",
  "revoked",
  "createdAt",
  "updatedAt",
  "userId",
]);

export const WebhookDeliveryScalarFieldEnumSchema = z.enum([
  "id",
  "provider",
  "deliveryId",
  "event",
  "status",
  "error",
  "createdAt",
  "updatedAt",
]);

export const AuditLogScalarFieldEnumSchema = z.enum([
  "id",
  "requestId",
  "model",
  "operation",
  "payload",
  "userId",
  "ip",
  "userAgent",
  "createdAt",
]);

export const ChatSessionScalarFieldEnumSchema = z.enum([
  "id",
  "userId",
  "repoId",
  "title",
  "createdAt",
  "updatedAt",
]);

export const ChatMessageScalarFieldEnumSchema = z.enum([
  "id",
  "sessionId",
  "role",
  "parts",
  "createdAt",
]);

export const SortOrderSchema = z.enum(["asc", "desc"]);

export const NullableJsonNullValueInputSchema: z.ZodType<Prisma.NullableJsonNullValueInput> = z
  .enum(["DbNull", "JsonNull"])
  .transform((value) =>
    value === "JsonNull" ? Prisma.JsonNull : value === "DbNull" ? Prisma.DbNull : value,
  );

export const JsonNullValueInputSchema: z.ZodType<Prisma.JsonNullValueInput> = z
  .enum(["JsonNull"])
  .transform((value) => (value === "JsonNull" ? Prisma.JsonNull : value));

export const QueryModeSchema = z.enum(["default", "insensitive"]);

export const NullsOrderSchema = z.enum(["first", "last"]);

export const UserOrderByRelevanceFieldEnumSchema = z.enum([
  "publicId",
  "email",
  "emailHash",
  "name",
  "image",
  "imageKey",
  "banReason",
  "lastLoginMethod",
]);

export const AccountOrderByRelevanceFieldEnumSchema = z.enum([
  "publicId",
  "accountId",
  "providerId",
  "email",
  "emailHash",
  "image",
  "name",
  "refreshToken",
  "accessToken",
  "tokenType",
  "scope",
  "idToken",
  "impersonatedBy",
]);

export const PasskeyOrderByRelevanceFieldEnumSchema = z.enum([
  "id",
  "name",
  "publicKey",
  "credentialID",
  "deviceType",
  "transports",
  "aaguid",
]);

export const TwoFactorOrderByRelevanceFieldEnumSchema = z.enum(["id", "secret", "backupCodes"]);

export const SessionOrderByRelevanceFieldEnumSchema = z.enum([
  "publicId",
  "token",
  "tokenHash",
  "ipAddress",
  "userAgent",
]);

export const VerificationOrderByRelevanceFieldEnumSchema = z.enum([
  "id",
  "identifier",
  "identifierHash",
  "value",
  "valueHash",
]);

export const BannedEmailOrderByRelevanceFieldEnumSchema = z.enum(["email", "emailHash"]);

export const RepoOrderByRelevanceFieldEnumSchema = z.enum([
  "publicId",
  "owner",
  "name",
  "description",
  "url",
  "language",
  "license",
  "topics",
  "defaultBranch",
  "ownerAvatarUrl",
]);

export const GithubInstallationOrderByRelevanceFieldEnumSchema = z.enum([
  "accountLogin",
  "accountAvatar",
  "htmlUrl",
]);

export const JsonNullValueFilterSchema: z.ZodType<Prisma.JsonNullValueFilter> = z
  .enum(["DbNull", "JsonNull", "AnyNull"])
  .transform((value) =>
    value === "JsonNull"
      ? Prisma.JsonNull
      : value === "DbNull"
        ? Prisma.DbNull
        : value === "AnyNull"
          ? Prisma.AnyNull
          : value,
  );

export const AnalysisOrderByRelevanceFieldEnumSchema = z.enum([
  "publicId",
  "message",
  "commitSha",
  "jobId",
  "logs",
  "error",
]);

export const DocumentOrderByRelevanceFieldEnumSchema = z.enum([
  "publicId",
  "version",
  "content",
  "path",
]);

export const PullRequestAnalysisOrderByRelevanceFieldEnumSchema = z.enum([
  "publicId",
  "owner",
  "repoName",
  "headSha",
  "baseSha",
  "jobId",
  "error",
]);

export const PullRequestAnalysisConfigOrderByRelevanceFieldEnumSchema = z.enum([
  "publicId",
  "excludePatterns",
]);

export const PullRequestCommentOrderByRelevanceFieldEnumSchema = z.enum([
  "publicId",
  "filePath",
  "body",
  "findingType",
]);

export const GeneratedFixOrderByRelevanceFieldEnumSchema = z.enum([
  "publicId",
  "title",
  "description",
  "branch",
  "githubPrUrl",
]);

export const NotificationOrderByRelevanceFieldEnumSchema = z.enum(["publicId", "title", "body"]);

export const ApiKeyOrderByRelevanceFieldEnumSchema = z.enum([
  "id",
  "prefix",
  "hashedKey",
  "name",
  "description",
]);

export const WebhookDeliveryOrderByRelevanceFieldEnumSchema = z.enum([
  "id",
  "provider",
  "deliveryId",
  "event",
  "error",
]);

export const AuditLogOrderByRelevanceFieldEnumSchema = z.enum([
  "id",
  "requestId",
  "model",
  "operation",
  "ip",
  "userAgent",
]);

export const ChatSessionOrderByRelevanceFieldEnumSchema = z.enum(["id", "title"]);

export const ChatMessageOrderByRelevanceFieldEnumSchema = z.enum(["id", "sessionId", "parts"]);

export const UserRoleSchema = z.enum(["USER", "ADMIN"]);

export type UserRoleType = `${z.infer<typeof UserRoleSchema>}`;

export const BannedEmailReasonSchema = z.enum([
  "BOUNCED",
  "COMPLAINED",
  "SUPPRESSED",
  "FAILED",
  "DISPOSABLE",
  "MANUAL",
]);

export type BannedEmailReasonType = `${z.infer<typeof BannedEmailReasonSchema>}`;

export const VisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);

export type VisibilityType = `${z.infer<typeof VisibilitySchema>}`;

export const InstallationTargetTypeSchema = z.enum(["USER", "ORGANIZATION"]);

export type InstallationTargetTypeType = `${z.infer<typeof InstallationTargetTypeSchema>}`;

export const RepositorySelectionSchema = z.enum(["ALL", "SELECTED"]);

export type RepositorySelectionType = `${z.infer<typeof RepositorySelectionSchema>}`;

export const PRAnalysisStatusSchema = z.enum(["PENDING", "ANALYZING", "COMPLETED", "FAILED"]);

export type PRAnalysisStatusType = `${z.infer<typeof PRAnalysisStatusSchema>}`;

export const FixStatusSchema = z.enum([
  "DRAFT",
  "GENERATING",
  "READY_TO_APPLY",
  "PR_OPENED",
  "COMPLETED",
  "FAILED",
]);

export type FixStatusType = `${z.infer<typeof FixStatusSchema>}`;

export const StatusSchema = z.enum(["PENDING", "DONE", "FAILED", "NEW"]);

export type StatusType = `${z.infer<typeof StatusSchema>}`;

export const DocTypeSchema = z.enum([
  "README",
  "API",
  "CONTRIBUTING",
  "CHANGELOG",
  "CODE_DOC",
  "ARCHITECTURE",
]);

export type DocTypeType = `${z.infer<typeof DocTypeSchema>}`;

export const PRCommentStyleSchema = z.enum(["CONCISE", "DETAILED", "OFF"]);

export type PRCommentStyleType = `${z.infer<typeof PRCommentStyleSchema>}`;

export const PRFocusAreaSchema = z.enum(["SECURITY", "PERFORMANCE", "ARCHITECTURE", "STYLE"]);

export type PRFocusAreaType = `${z.infer<typeof PRFocusAreaSchema>}`;

export const NotifyTypeSchema = z.enum(["ERROR", "WARNING", "INFO", "SUCCESS"]);

export type NotifyTypeType = `${z.infer<typeof NotifyTypeSchema>}`;

export const WebhookStatusSchema = z.enum(["PROCESSING", "SUCCESS", "FAILED"]);

export type WebhookStatusType = `${z.infer<typeof WebhookStatusSchema>}`;

export const ChatRoleSchema = z.enum(["user", "assistant", "system", "data"]);

export type ChatRoleType = `${z.infer<typeof ChatRoleSchema>}`;

/////////////////////////////////////////
// MODELS
/////////////////////////////////////////

/////////////////////////////////////////
// USER SCHEMA
/////////////////////////////////////////

export const UserSchema = z.object({
  banExpires: z.coerce.date().nullable(),
  // omitted: imageKey: z.string().nullable(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  createdAt: z.coerce.date(),
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  /**
   * @encrypted
   */
  email: z.email({ message: "Incorrect email" }).nullable(),
  emailVerified: z.boolean(),
  image: z.string().nullable().nullish(),
  lastLoginMethod: z.string().nullable(),
  /**
   * @encryption:hash(email)?normalize=lowercase&normalize=trim
   */
  // omitted: emailHash: z.string().nullable(),
  name: z
    .string()
    .trim()
    .min(1, { message: "Name required" })
    .max(50, { message: "Name cannot exceed 50 characters" })
    .nullable(),
  role: UserRoleSchema,
  twoFactorEnabled: z.boolean(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

/////////////////////////////////////////
// ACCOUNT SCHEMA
/////////////////////////////////////////

export const AccountSchema = z.object({
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  // omitted: userId: z.number().int(),
  accountId: z.string(),
  /**
   * @encrypted
   */
  // omitted: idToken: z.string().nullable(),
  // omitted: impersonatedBy: z.string().nullable(),
  createdAt: z.coerce.date(),
  /**
   * @encrypted
   */
  email: z.email({ message: "Incorrect email" }).nullable(),
  /**
   * @encryption:hash(email)?normalize=lowercase&normalize=trim
   */
  // omitted: emailHash: z.string().nullable(),
  image: z.url({ message: "Incorrect link to avatar" }).nullable(),
  name: z.string().nullable(),
  providerId: z.string(),
  scope: z.string().nullable(),
  /**
   * @encrypted
   */
  // omitted: refreshToken: z.string().nullable(),
  /**
   * @encrypted
   */
  // omitted: accessToken: z.string().nullable(),
  // omitted: accessTokenExpiresAt: z.coerce.date().nullable(),
  // omitted: refreshTokenExpiresAt: z.coerce.date().nullable(),
  tokenType: z.string().nullable(),
  updatedAt: z.coerce.date(),
});

export type Account = z.infer<typeof AccountSchema>;

/////////////////////////////////////////
// PASSKEY SCHEMA
/////////////////////////////////////////

export const PasskeySchema = z.object({
  aaguid: z.uuid().nullable(),
  backedUp: z.boolean(),
  // omitted: publicKey: z.string(),
  // omitted: userId: z.number().int(),
  // omitted: credentialID: z.string(),
  counter: z.number().int().min(0),
  createdAt: z.coerce.date().nullable(),
  deviceType: z.string().trim(),
  // omitted: id: z.uuid(),
  name: z.string().trim().max(100, { message: "Name cannot exceed 100 characters" }).nullable(),
  transports: z.string().nullable(),
  updatedAt: z.coerce.date().nullable(),
});

export type Passkey = z.infer<typeof PasskeySchema>;

/////////////////////////////////////////
// TWO FACTOR SCHEMA
/////////////////////////////////////////

export const TwoFactorSchema = z.object({
  // omitted: userId: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // omitted: id: z.uuid(),
  // omitted: secret: z.string(),
  // omitted: backupCodes: z.string(),
  verified: z.boolean(),
});

export type TwoFactor = z.infer<typeof TwoFactorSchema>;

/////////////////////////////////////////
// SESSION SCHEMA
/////////////////////////////////////////

export const SessionSchema = z.object({
  // omitted: userId: z.number().int(),
  createdAt: z.coerce.date(),
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  /**
   * @encrypted
   */
  // omitted: token: z.string(),
  /**
   * @encryption:hash(token)
   */
  // omitted: tokenHash: z.string().nullable(),
  expiresAt: z.coerce.date(),
  ipAddress: z.string().nullable(),
  updatedAt: z.coerce.date(),
  userAgent: z.string().nullable(),
});

export type Session = z.infer<typeof SessionSchema>;

/////////////////////////////////////////
// VERIFICATION SCHEMA
/////////////////////////////////////////

export const VerificationSchema = z.object({
  createdAt: z.coerce.date(),
  /**
   * @encrypted
   */
  // omitted: value: z.string(),
  /**
   * @encryption:hash(value)
   */
  // omitted: valueHash: z.string(),
  expiresAt: z.coerce.date(),
  id: z.uuid(),
  /**
   * @encrypted
   */
  identifier: z.string(),
  /**
   * @encryption:hash(identifier)?normalize=lowercase&normalize=trim
   */
  identifierHash: z.string(),
  updatedAt: z.coerce.date(),
});

export type Verification = z.infer<typeof VerificationSchema>;

/////////////////////////////////////////
// BANNED EMAIL SCHEMA
/////////////////////////////////////////

export const BannedEmailSchema = z.object({
  /**
   * @encryption:hash(email)?normalize=lowercase&normalize=trim
   */
  // omitted: emailHash: z.string().nullable(),
  createdAt: z.coerce.date(),
  /**
   * @encrypted
   */
  email: z.email({ message: "Incorrect email" }),
  id: z.number().int(),
  reason: BannedEmailReasonSchema,
  updatedAt: z.coerce.date(),
});

export type BannedEmail = z.infer<typeof BannedEmailSchema>;

/////////////////////////////////////////
// REPO SCHEMA
/////////////////////////////////////////

export const RepoSchema = z.object({
  createdAt: z.coerce.date(),
  defaultBranch: z.string(),
  description: z.string().max(1000).nullable(),
  forks: z.number().int().min(0),
  githubCreatedAt: z.coerce.date().nullable(),
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  githubId: z.number().int(),
  language: z.string().nullable(),
  license: z.string().nullable(),
  name: z.string().min(1).max(255),
  openIssues: z.number().int().min(0),
  owner: z.string(),
  ownerAvatarUrl: z.url().nullable(),
  pushedAt: z.coerce.date().nullable(),
  size: z.number().int().min(0),
  stars: z.number().int().min(0),
  topics: z.string().array(),
  updatedAt: z.coerce.date(),
  url: z.url({ message: "Invalid repository URL" }),
  visibility: VisibilitySchema,
  // omitted: userId: z.number().int(),
});

export type Repo = z.infer<typeof RepoSchema>;

/////////////////////////////////////////
// GITHUB INSTALLATION SCHEMA
/////////////////////////////////////////

export const GithubInstallationSchema = z.object({
  accountAvatar: z.string().nullable(),
  accountLogin: z.string(),
  appId: z.number().int(),
  createdAt: z.coerce.date(),
  htmlUrl: z.string().nullable(),
  id: z.bigint(),
  isSuspended: z.boolean(),
  repositorySelection: RepositorySelectionSchema,
  targetId: z.bigint(),
  targetType: InstallationTargetTypeSchema,
  updatedAt: z.coerce.date(),
  userId: z.number().int().nullable(),
});

export type GithubInstallation = z.infer<typeof GithubInstallationSchema>;

/////////////////////////////////////////
// ANALYSIS SCHEMA
/////////////////////////////////////////

export const AnalysisSchema = z.object({
  commitSha: z.string().nullable(),
  complexityScore: z.number().int().min(0).max(100).nullable(),
  createdAt: z.coerce.date(),
  error: z.string().nullable(),
  jobId: z.string().nullable(),
  logs: z.string().nullable(),
  message: z.string().nullable(),
  metricsJson: JsonValueSchema.nullable(),
  onboardingScore: z.number().int().min(0).max(100).nullable(),
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  progress: z.number().int().min(0).max(100),
  resultJson: JsonValueSchema.nullable(),
  score: z.number().int().min(0).max(100).nullable(),
  securityScore: z.number().int().min(0).max(100).nullable(),
  status: StatusSchema,
  techDebtScore: z.number().int().min(0).max(100).nullable(),
  updatedAt: z.coerce.date(),
  // omitted: repoId: z.number().int(),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

/////////////////////////////////////////
// DOCUMENT SCHEMA
/////////////////////////////////////////

export const DocumentSchema = z.object({
  // omitted: repoId: z.number().int(),
  analysisId: z.number().int().nullable(),
  content: z.string().min(1, { message: "Content cannot be empty" }),
  createdAt: z.coerce.date(),
  path: z.string().nullable(),
  type: DocTypeSchema,
  updatedAt: z.coerce.date(),
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  version: z.string(),
});

export type Document = z.infer<typeof DocumentSchema>;

/////////////////////////////////////////
// PULL REQUEST ANALYSIS SCHEMA
/////////////////////////////////////////

export const PullRequestAnalysisSchema = z.object({
  baseSha: z.string(),
  changedFilesJson: JsonValueSchema.nullable(),
  createdAt: z.coerce.date(),
  error: z.string().nullable(),
  findingsJson: JsonValueSchema.nullable(),
  headSha: z.string(),
  jobId: z.string().nullable(),
  owner: z.string(),
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  prNumber: z.number().int(),
  repoName: z.string(),
  riskScore: z.number().int().min(0).max(10).nullable(),
  status: PRAnalysisStatusSchema,
  updatedAt: z.coerce.date(),
  // omitted: repoId: z.number().int(),
});

export type PullRequestAnalysis = z.infer<typeof PullRequestAnalysisSchema>;

/////////////////////////////////////////
// PULL REQUEST ANALYSIS CONFIG SCHEMA
/////////////////////////////////////////

export const PullRequestAnalysisConfigSchema = z.object({
  ciSkip: z.boolean(),
  commentStyle: PRCommentStyleSchema,
  createdAt: z.coerce.date(),
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  enabled: z.boolean(),
  excludePatterns: z.string().array(),
  focusAreas: PRFocusAreaSchema.array(),
  tokenBudget: z.number().int(),
  updatedAt: z.coerce.date(),
  // omitted: repoId: z.number().int(),
});

export type PullRequestAnalysisConfig = z.infer<typeof PullRequestAnalysisConfigSchema>;

/////////////////////////////////////////
// PULL REQUEST COMMENT SCHEMA
/////////////////////////////////////////

export const PullRequestCommentSchema = z.object({
  body: z.string().min(1, { message: "Comment body cannot be empty" }),
  createdAt: z.coerce.date(),
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  filePath: z.string(),
  findingType: z.string(),
  githubCommentId: z.bigint().nullable(),
  line: z.number().int(),
  riskLevel: z.number().int().min(0).max(10),
  updatedAt: z.coerce.date(),
  // omitted: analysisId: z.number().int(),
});

export type PullRequestComment = z.infer<typeof PullRequestCommentSchema>;

/////////////////////////////////////////
// GENERATED FIX SCHEMA
/////////////////////////////////////////

export const GeneratedFixSchema = z.object({
  branch: z.string().min(1),
  createdAt: z.coerce.date(),
  createdByUser: z.boolean(),
  description: z.string().nullable(),
  estimatedImpact: z.number().int().min(0).max(100).nullable(),
  githubPrNumber: z.number().int().nullable(),
  githubPrUrl: z.string().nullable(),
  status: FixStatusSchema,
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  title: z.string(),
  updatedAt: z.coerce.date(),
  // omitted: repoId: z.number().int(),
  // omitted: prAnalysisId: z.number().int().nullable(),
});

export type GeneratedFix = z.infer<typeof GeneratedFixSchema>;

/////////////////////////////////////////
// NOTIFICATION SCHEMA
/////////////////////////////////////////

export const NotificationSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, { message: "The text of the notification is mandatory" })
    .max(5000, { message: "The text of the notification cannot exceed 5000 characters" }),
  createdAt: z.coerce.date(),
  isRead: z.boolean(),
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  title: z
    .string()
    .trim()
    .min(1, { message: "The title cannot be empty" })
    .max(300, { message: "The title cannot exceed 300 characters" }),
  type: NotifyTypeSchema,
  updatedAt: z.coerce.date(),
  // omitted: userId: z.number().int(),
  // omitted: repoId: z.number().int().nullable(),
});

export type Notification = z.infer<typeof NotificationSchema>;

/////////////////////////////////////////
// API KEY SCHEMA
/////////////////////////////////////////

export const ApiKeySchema = z.object({
  createdAt: z.coerce.date(),
  description: z
    .string()
    .trim()
    .max(1000, { message: "The description must be less than 1000 characters" })
    .nullable(),
  id: z.uuid(),
  lastUsed: z.coerce.date().nullable(),
  // omitted: hashedKey: z.string(),
  name: z
    .string()
    .trim()
    .min(1, { message: "The name must be between 1 and 50 characters long" })
    .max(50),
  prefix: z.string(),
  revoked: z.boolean(),
  updatedAt: z.coerce.date(),
  // omitted: userId: z.number().int(),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;

/////////////////////////////////////////
// WEBHOOK DELIVERY SCHEMA
/////////////////////////////////////////

export const WebhookDeliverySchema = z.object({
  createdAt: z.coerce.date(),
  deliveryId: z.string(),
  error: z.string().nullable(),
  event: z.string().nullable(),
  id: z.uuid(),
  provider: z.string(),
  status: WebhookStatusSchema,
  updatedAt: z.coerce.date(),
});

export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;

/////////////////////////////////////////
// AUDIT LOG SCHEMA
/////////////////////////////////////////

export const AuditLogSchema = z.object({
  createdAt: z.coerce.date(),
  id: z.uuid(),
  // omitted: userId: z.number().int().nullable(),
  ip: z.string().nullable(),
  model: z.string(),
  operation: z.string(),
  payload: JsonValueSchema,
  requestId: z.string().nullable(),
  userAgent: z.string().nullable(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

/////////////////////////////////////////
// CHAT SESSION SCHEMA
/////////////////////////////////////////

export const ChatSessionSchema = z.object({
  createdAt: z.coerce.date(),
  id: z.uuid(),
  repoId: z.number().int().nullable(),
  title: z.string(),
  updatedAt: z.coerce.date(),
  userId: z.number().int(),
});

export type ChatSession = z.infer<typeof ChatSessionSchema>;

/////////////////////////////////////////
// CHAT MESSAGE SCHEMA
/////////////////////////////////////////

export const ChatMessageSchema = z.object({
  createdAt: z.coerce.date(),
  id: z.uuid(),
  /**
   * @encrypted
   */
  parts: z.string(),
  role: ChatRoleSchema,
  sessionId: z.string(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
