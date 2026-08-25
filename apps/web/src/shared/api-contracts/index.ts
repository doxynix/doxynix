import { z } from 'zod';
import { Prisma } from '@prisma/client';

/////////////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////

// JSON
//------------------------------------------------------

export type NullableJsonInput = Prisma.JsonValue | null | 'JsonNull' | 'DbNull' | Prisma.NullTypes.DbNull | Prisma.NullTypes.JsonNull;

export const transformJsonNull = (v?: NullableJsonInput) => {
  if (!v || v === 'DbNull') return Prisma.NullTypes.DbNull;
  if (v === 'JsonNull') return Prisma.NullTypes.JsonNull;
  return v;
};

export const JsonValueSchema: z.ZodType<Prisma.JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.literal(null),
    z.record(z.string(), z.lazy(() => JsonValueSchema.optional())),
    z.array(z.lazy(() => JsonValueSchema)),
  ])
);

export type JsonValueType = z.infer<typeof JsonValueSchema>;

export const NullableJsonValue = z
  .union([JsonValueSchema, z.literal('DbNull'), z.literal('JsonNull')])
  .nullable()
  .transform((v) => transformJsonNull(v));

export type NullableJsonValueType = z.infer<typeof NullableJsonValue>;

export const InputJsonValueSchema: z.ZodType<Prisma.InputJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.object({ toJSON: z.any() }),
    z.record(z.string(), z.lazy(() => z.union([InputJsonValueSchema, z.literal(null)]))),
    z.array(z.lazy(() => z.union([InputJsonValueSchema, z.literal(null)]))),
  ])
);

export type InputJsonValueType = z.infer<typeof InputJsonValueSchema>;


/////////////////////////////////////////
// ENUMS
/////////////////////////////////////////

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted','ReadCommitted','RepeatableRead','Serializable']);

export const UserScalarFieldEnumSchema = z.enum(['id','publicId','email','emailHash','name','emailVerified','image','imageKey','role','banned','banReason','banExpires','twoFactorEnabled','lastLoginMethod','createdAt','updatedAt']);

export const RelationLoadStrategySchema = z.enum(['query','join']);

export const AccountScalarFieldEnumSchema = z.enum(['id','publicId','userId','accountId','providerId','email','emailHash','image','name','refreshToken','accessToken','accessTokenExpiresAt','refreshTokenExpiresAt','tokenType','scope','idToken','impersonatedBy','createdAt','updatedAt']);

export const PasskeyScalarFieldEnumSchema = z.enum(['id','name','publicKey','userId','credentialID','counter','deviceType','backedUp','transports','aaguid','createdAt','updatedAt']);

export const TwoFactorScalarFieldEnumSchema = z.enum(['id','secret','backupCodes','verified','userId','createdAt','updatedAt']);

export const SessionScalarFieldEnumSchema = z.enum(['id','publicId','token','tokenHash','expiresAt','ipAddress','userAgent','userId','createdAt','updatedAt']);

export const VerificationScalarFieldEnumSchema = z.enum(['id','identifier','identifierHash','value','valueHash','expiresAt','createdAt','updatedAt']);

export const BannedEmailScalarFieldEnumSchema = z.enum(['id','email','emailHash','reason','createdAt','updatedAt']);

export const RepoScalarFieldEnumSchema = z.enum(['id','publicId','githubId','owner','name','description','url','language','license','topics','stars','forks','defaultBranch','ownerAvatarUrl','openIssues','size','visibility','pushedAt','createdAt','githubCreatedAt','updatedAt','userId']);

export const GithubInstallationScalarFieldEnumSchema = z.enum(['id','appId','targetId','targetType','accountLogin','accountAvatar','repositorySelection','isSuspended','htmlUrl','createdAt','updatedAt','userId']);

export const AnalysisScalarFieldEnumSchema = z.enum(['id','publicId','status','progress','message','score','securityScore','complexityScore','techDebtScore','onboardingScore','metricsJson','resultJson','commitSha','jobId','logs','error','createdAt','updatedAt','repoId']);

export const DocumentScalarFieldEnumSchema = z.enum(['id','publicId','version','type','content','path','createdAt','updatedAt','repoId','analysisId']);

export const PullRequestAnalysisScalarFieldEnumSchema = z.enum(['id','publicId','prNumber','owner','repoName','headSha','baseSha','status','riskScore','findingsJson','changedFilesJson','jobId','error','createdAt','updatedAt','repoId']);

export const PullRequestAnalysisConfigScalarFieldEnumSchema = z.enum(['id','publicId','enabled','ciSkip','commentStyle','tokenBudget','focusAreas','excludePatterns','createdAt','updatedAt','repoId']);

export const PullRequestCommentScalarFieldEnumSchema = z.enum(['id','publicId','filePath','line','riskLevel','body','findingType','githubCommentId','createdAt','updatedAt','analysisId']);

export const GeneratedFixScalarFieldEnumSchema = z.enum(['id','publicId','title','description','branch','status','estimatedImpact','githubPrUrl','githubPrNumber','createdAt','updatedAt','createdByUser','repoId','prAnalysisId']);

export const NotificationScalarFieldEnumSchema = z.enum(['id','publicId','title','body','type','isRead','createdAt','updatedAt','userId','repoId']);

export const ApiKeyScalarFieldEnumSchema = z.enum(['id','prefix','hashedKey','name','description','lastUsed','revoked','createdAt','updatedAt','userId']);

export const WebhookDeliveryScalarFieldEnumSchema = z.enum(['id','provider','deliveryId','event','status','error','createdAt','updatedAt']);

export const AuditLogScalarFieldEnumSchema = z.enum(['id','requestId','model','operation','payload','userId','ip','userAgent','createdAt']);

export const ChatSessionScalarFieldEnumSchema = z.enum(['id','userId','repoId','title','createdAt','updatedAt']);

export const ChatMessageScalarFieldEnumSchema = z.enum(['id','sessionId','role','parts','createdAt']);

export const SortOrderSchema = z.enum(['asc','desc']);

export const NullableJsonNullValueInputSchema: z.ZodType<Prisma.NullableJsonNullValueInput> = z.enum(['DbNull','JsonNull',]).transform((value) => value === 'JsonNull' ? Prisma.JsonNull : value === 'DbNull' ? Prisma.DbNull : value);

export const JsonNullValueInputSchema: z.ZodType<Prisma.JsonNullValueInput> = z.enum(['JsonNull',]).transform((value) => (value === 'JsonNull' ? Prisma.JsonNull : value));

export const QueryModeSchema = z.enum(['default','insensitive']);

export const NullsOrderSchema = z.enum(['first','last']);

export const UserOrderByRelevanceFieldEnumSchema = z.enum(['publicId','email','emailHash','name','image','imageKey','banReason','lastLoginMethod']);

export const AccountOrderByRelevanceFieldEnumSchema = z.enum(['publicId','accountId','providerId','email','emailHash','image','name','refreshToken','accessToken','tokenType','scope','idToken','impersonatedBy']);

export const PasskeyOrderByRelevanceFieldEnumSchema = z.enum(['id','name','publicKey','credentialID','deviceType','transports','aaguid']);

export const TwoFactorOrderByRelevanceFieldEnumSchema = z.enum(['id','secret','backupCodes']);

export const SessionOrderByRelevanceFieldEnumSchema = z.enum(['publicId','token','tokenHash','ipAddress','userAgent']);

export const VerificationOrderByRelevanceFieldEnumSchema = z.enum(['id','identifier','identifierHash','value','valueHash']);

export const BannedEmailOrderByRelevanceFieldEnumSchema = z.enum(['email','emailHash']);

export const RepoOrderByRelevanceFieldEnumSchema = z.enum(['publicId','owner','name','description','url','language','license','topics','defaultBranch','ownerAvatarUrl']);

export const GithubInstallationOrderByRelevanceFieldEnumSchema = z.enum(['accountLogin','accountAvatar','htmlUrl']);

export const JsonNullValueFilterSchema: z.ZodType<Prisma.JsonNullValueFilter> = z.enum(['DbNull','JsonNull','AnyNull',]).transform((value) => value === 'JsonNull' ? Prisma.JsonNull : value === 'DbNull' ? Prisma.DbNull : value === 'AnyNull' ? Prisma.AnyNull : value);

export const AnalysisOrderByRelevanceFieldEnumSchema = z.enum(['publicId','message','commitSha','jobId','logs','error']);

export const DocumentOrderByRelevanceFieldEnumSchema = z.enum(['publicId','version','content','path']);

export const PullRequestAnalysisOrderByRelevanceFieldEnumSchema = z.enum(['publicId','owner','repoName','headSha','baseSha','jobId','error']);

export const PullRequestAnalysisConfigOrderByRelevanceFieldEnumSchema = z.enum(['publicId','excludePatterns']);

export const PullRequestCommentOrderByRelevanceFieldEnumSchema = z.enum(['publicId','filePath','body','findingType']);

export const GeneratedFixOrderByRelevanceFieldEnumSchema = z.enum(['publicId','title','description','branch','githubPrUrl']);

export const NotificationOrderByRelevanceFieldEnumSchema = z.enum(['publicId','title','body']);

export const ApiKeyOrderByRelevanceFieldEnumSchema = z.enum(['id','prefix','hashedKey','name','description']);

export const WebhookDeliveryOrderByRelevanceFieldEnumSchema = z.enum(['id','provider','deliveryId','event','error']);

export const AuditLogOrderByRelevanceFieldEnumSchema = z.enum(['id','requestId','model','operation','ip','userAgent']);

export const ChatSessionOrderByRelevanceFieldEnumSchema = z.enum(['id','title']);

export const ChatMessageOrderByRelevanceFieldEnumSchema = z.enum(['id','sessionId','parts']);

export const UserRoleSchema = z.enum(['USER','ADMIN']);

export type UserRoleType = `${z.infer<typeof UserRoleSchema>}`

export const BannedEmailReasonSchema = z.enum(['BOUNCED','COMPLAINED','SUPPRESSED','FAILED','DISPOSABLE','MANUAL']);

export type BannedEmailReasonType = `${z.infer<typeof BannedEmailReasonSchema>}`

export const VisibilitySchema = z.enum(['PUBLIC','PRIVATE']);

export type VisibilityType = `${z.infer<typeof VisibilitySchema>}`

export const InstallationTargetTypeSchema = z.enum(['USER','ORGANIZATION']);

export type InstallationTargetTypeType = `${z.infer<typeof InstallationTargetTypeSchema>}`

export const RepositorySelectionSchema = z.enum(['ALL','SELECTED']);

export type RepositorySelectionType = `${z.infer<typeof RepositorySelectionSchema>}`

export const PRAnalysisStatusSchema = z.enum(['PENDING','ANALYZING','COMPLETED','FAILED']);

export type PRAnalysisStatusType = `${z.infer<typeof PRAnalysisStatusSchema>}`

export const FixStatusSchema = z.enum(['DRAFT','GENERATING','READY_TO_APPLY','PR_OPENED','COMPLETED','FAILED']);

export type FixStatusType = `${z.infer<typeof FixStatusSchema>}`

export const StatusSchema = z.enum(['PENDING','DONE','FAILED','NEW']);

export type StatusType = `${z.infer<typeof StatusSchema>}`

export const DocTypeSchema = z.enum(['README','API','CONTRIBUTING','CHANGELOG','CODE_DOC','ARCHITECTURE']);

export type DocTypeType = `${z.infer<typeof DocTypeSchema>}`

export const PRCommentStyleSchema = z.enum(['CONCISE','DETAILED','OFF']);

export type PRCommentStyleType = `${z.infer<typeof PRCommentStyleSchema>}`

export const PRFocusAreaSchema = z.enum(['SECURITY','PERFORMANCE','ARCHITECTURE','STYLE']);

export type PRFocusAreaType = `${z.infer<typeof PRFocusAreaSchema>}`

export const NotifyTypeSchema = z.enum(['ERROR','WARNING','INFO','SUCCESS']);

export type NotifyTypeType = `${z.infer<typeof NotifyTypeSchema>}`

export const WebhookStatusSchema = z.enum(['PROCESSING','SUCCESS','FAILED']);

export type WebhookStatusType = `${z.infer<typeof WebhookStatusSchema>}`

export const ChatRoleSchema = z.enum(['user','assistant','system','data']);

export type ChatRoleType = `${z.infer<typeof ChatRoleSchema>}`

/////////////////////////////////////////
// MODELS
/////////////////////////////////////////

/////////////////////////////////////////
// USER SCHEMA
/////////////////////////////////////////

export const UserSchema = z.object({
  role: UserRoleSchema,
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  /**
   * @encrypted
   */
  email: z.email({ message: "Incorrect email" }).nullable(),
  /**
   * @encryption:hash(email)?normalize=lowercase&normalize=trim
   */
  // omitted: emailHash: z.string().nullable(),
  name: z.string().trim().min(1, { message: "Name required" }).max(50, { message: "Name cannot exceed 50 characters" }).nullable(),
  emailVerified: z.boolean(),
  image: z.url({ message: "Incorrect link to avatar" }).nullable(),
  // omitted: imageKey: z.string().nullable(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  banExpires: z.coerce.date().nullable(),
  twoFactorEnabled: z.boolean(),
  lastLoginMethod: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type User = z.infer<typeof UserSchema>

/////////////////////////////////////////
// ACCOUNT SCHEMA
/////////////////////////////////////////

export const AccountSchema = z.object({
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  // omitted: userId: z.number().int(),
  accountId: z.string(),
  providerId: z.string(),
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
  scope: z.string().nullable(),
  /**
   * @encrypted
   */
  // omitted: idToken: z.string().nullable(),
  // omitted: impersonatedBy: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Account = z.infer<typeof AccountSchema>

/////////////////////////////////////////
// PASSKEY SCHEMA
/////////////////////////////////////////

export const PasskeySchema = z.object({
  // omitted: id: z.uuid(),
  name: z.string().trim().max(100, { message: "Name cannot exceed 100 characters" }).nullable(),
  // omitted: publicKey: z.string(),
  // omitted: userId: z.number().int(),
  // omitted: credentialID: z.string(),
  counter: z.number().int().min(0),
  deviceType: z.string().trim(),
  backedUp: z.boolean(),
  transports: z.string().nullable(),
  aaguid: z.uuid().nullable(),
  createdAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date().nullable(),
})

export type Passkey = z.infer<typeof PasskeySchema>

/////////////////////////////////////////
// TWO FACTOR SCHEMA
/////////////////////////////////////////

export const TwoFactorSchema = z.object({
  // omitted: id: z.uuid(),
  // omitted: secret: z.string(),
  // omitted: backupCodes: z.string(),
  verified: z.boolean(),
  // omitted: userId: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type TwoFactor = z.infer<typeof TwoFactorSchema>

/////////////////////////////////////////
// SESSION SCHEMA
/////////////////////////////////////////

export const SessionSchema = z.object({
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
  userAgent: z.string().nullable(),
  // omitted: userId: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Session = z.infer<typeof SessionSchema>

/////////////////////////////////////////
// VERIFICATION SCHEMA
/////////////////////////////////////////

export const VerificationSchema = z.object({
  id: z.uuid(),
  /**
   * @encrypted
   */
  identifier: z.string(),
  /**
   * @encryption:hash(identifier)?normalize=lowercase&normalize=trim
   */
  identifierHash: z.string(),
  /**
   * @encrypted
   */
  // omitted: value: z.string(),
  /**
   * @encryption:hash(value)
   */
  // omitted: valueHash: z.string(),
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Verification = z.infer<typeof VerificationSchema>

/////////////////////////////////////////
// BANNED EMAIL SCHEMA
/////////////////////////////////////////

export const BannedEmailSchema = z.object({
  reason: BannedEmailReasonSchema,
  id: z.number().int(),
  /**
   * @encrypted
   */
  email: z.email({ message: "Incorrect email" }),
  /**
   * @encryption:hash(email)?normalize=lowercase&normalize=trim
   */
  // omitted: emailHash: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type BannedEmail = z.infer<typeof BannedEmailSchema>

/////////////////////////////////////////
// REPO SCHEMA
/////////////////////////////////////////

export const RepoSchema = z.object({
  visibility: VisibilitySchema,
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  githubId: z.number().int(),
  owner: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable(),
  url: z.url({ message: "Invalid repository URL" }),
  language: z.string().nullable(),
  license: z.string().nullable(),
  topics: z.string().array(),
  stars: z.number().int().min(0),
  forks: z.number().int().min(0),
  defaultBranch: z.string(),
  ownerAvatarUrl: z.url().nullable(),
  openIssues: z.number().int().min(0),
  size: z.number().int().min(0),
  pushedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  githubCreatedAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date(),
  // omitted: userId: z.number().int(),
})

export type Repo = z.infer<typeof RepoSchema>

/////////////////////////////////////////
// GITHUB INSTALLATION SCHEMA
/////////////////////////////////////////

export const GithubInstallationSchema = z.object({
  targetType: InstallationTargetTypeSchema,
  repositorySelection: RepositorySelectionSchema,
  id: z.bigint(),
  appId: z.number().int(),
  targetId: z.bigint(),
  accountLogin: z.string(),
  accountAvatar: z.string().nullable(),
  isSuspended: z.boolean(),
  htmlUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  userId: z.number().int().nullable(),
})

export type GithubInstallation = z.infer<typeof GithubInstallationSchema>

/////////////////////////////////////////
// ANALYSIS SCHEMA
/////////////////////////////////////////

export const AnalysisSchema = z.object({
  status: StatusSchema,
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  progress: z.number().int().min(0).max(100),
  message: z.string().nullable(),
  score: z.number().int().min(0).max(100).nullable(),
  securityScore: z.number().int().min(0).max(100).nullable(),
  complexityScore: z.number().int().min(0).max(100).nullable(),
  techDebtScore: z.number().int().min(0).max(100).nullable(),
  onboardingScore: z.number().int().min(0).max(100).nullable(),
  metricsJson: JsonValueSchema.nullable(),
  resultJson: JsonValueSchema.nullable(),
  commitSha: z.string().nullable(),
  jobId: z.string().nullable(),
  logs: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // omitted: repoId: z.number().int(),
})

export type Analysis = z.infer<typeof AnalysisSchema>

/////////////////////////////////////////
// DOCUMENT SCHEMA
/////////////////////////////////////////

export const DocumentSchema = z.object({
  type: DocTypeSchema,
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  version: z.string(),
  content: z.string().min(1, { message: "Content cannot be empty" }),
  path: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // omitted: repoId: z.number().int(),
  analysisId: z.number().int().nullable(),
})

export type Document = z.infer<typeof DocumentSchema>

/////////////////////////////////////////
// PULL REQUEST ANALYSIS SCHEMA
/////////////////////////////////////////

export const PullRequestAnalysisSchema = z.object({
  status: PRAnalysisStatusSchema,
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  prNumber: z.number().int(),
  owner: z.string(),
  repoName: z.string(),
  headSha: z.string(),
  baseSha: z.string(),
  riskScore: z.number().int().min(0).max(10).nullable(),
  findingsJson: JsonValueSchema.nullable(),
  changedFilesJson: JsonValueSchema.nullable(),
  jobId: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // omitted: repoId: z.number().int(),
})

export type PullRequestAnalysis = z.infer<typeof PullRequestAnalysisSchema>

/////////////////////////////////////////
// PULL REQUEST ANALYSIS CONFIG SCHEMA
/////////////////////////////////////////

export const PullRequestAnalysisConfigSchema = z.object({
  commentStyle: PRCommentStyleSchema,
  focusAreas: PRFocusAreaSchema.array(),
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  enabled: z.boolean(),
  ciSkip: z.boolean(),
  tokenBudget: z.number().int(),
  excludePatterns: z.string().array(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // omitted: repoId: z.number().int(),
})

export type PullRequestAnalysisConfig = z.infer<typeof PullRequestAnalysisConfigSchema>

/////////////////////////////////////////
// PULL REQUEST COMMENT SCHEMA
/////////////////////////////////////////

export const PullRequestCommentSchema = z.object({
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  filePath: z.string(),
  line: z.number().int(),
  riskLevel: z.number().int().min(0).max(10),
  body: z.string().min(1, { message: "Comment body cannot be empty" }),
  findingType: z.string(),
  githubCommentId: z.bigint().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // omitted: analysisId: z.number().int(),
})

export type PullRequestComment = z.infer<typeof PullRequestCommentSchema>

/////////////////////////////////////////
// GENERATED FIX SCHEMA
/////////////////////////////////////////

export const GeneratedFixSchema = z.object({
  status: FixStatusSchema,
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  branch: z.string().min(1),
  estimatedImpact: z.number().int().min(0).max(100).nullable(),
  githubPrUrl: z.string().nullable(),
  githubPrNumber: z.number().int().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdByUser: z.boolean(),
  // omitted: repoId: z.number().int(),
  // omitted: prAnalysisId: z.number().int().nullable(),
})

export type GeneratedFix = z.infer<typeof GeneratedFixSchema>

/////////////////////////////////////////
// NOTIFICATION SCHEMA
/////////////////////////////////////////

export const NotificationSchema = z.object({
  type: NotifyTypeSchema,
  // omitted: id: z.number().int(),
  // omitted: publicId: z.uuid(),
  title: z.string().trim().min(1, { message: "The title cannot be empty" }).max(300, { message: "The title cannot exceed 300 characters" }),
  body: z.string().trim().min(1, { message: "The text of the notification is mandatory" }).max(5000, { message: "The text of the notification cannot exceed 5000 characters" }),
  isRead: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // omitted: userId: z.number().int(),
  // omitted: repoId: z.number().int().nullable(),
})

export type Notification = z.infer<typeof NotificationSchema>

/////////////////////////////////////////
// API KEY SCHEMA
/////////////////////////////////////////

export const ApiKeySchema = z.object({
  id: z.uuid(),
  prefix: z.string(),
  // omitted: hashedKey: z.string(),
  name: z.string().trim().min(1, { message: "The name must be between 1 and 50 characters long" }).max(50),
  description: z.string().trim().max(1000, { message: "The description must be less than 1000 characters" }).nullable(),
  lastUsed: z.coerce.date().nullable(),
  revoked: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // omitted: userId: z.number().int(),
})

export type ApiKey = z.infer<typeof ApiKeySchema>

/////////////////////////////////////////
// WEBHOOK DELIVERY SCHEMA
/////////////////////////////////////////

export const WebhookDeliverySchema = z.object({
  status: WebhookStatusSchema,
  id: z.uuid(),
  provider: z.string(),
  deliveryId: z.string(),
  event: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>

/////////////////////////////////////////
// AUDIT LOG SCHEMA
/////////////////////////////////////////

export const AuditLogSchema = z.object({
  id: z.uuid(),
  requestId: z.string().nullable(),
  model: z.string(),
  operation: z.string(),
  payload: JsonValueSchema,
  // omitted: userId: z.number().int().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.coerce.date(),
})

export type AuditLog = z.infer<typeof AuditLogSchema>

/////////////////////////////////////////
// CHAT SESSION SCHEMA
/////////////////////////////////////////

export const ChatSessionSchema = z.object({
  id: z.uuid(),
  userId: z.number().int(),
  repoId: z.number().int().nullable(),
  title: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type ChatSession = z.infer<typeof ChatSessionSchema>

/////////////////////////////////////////
// CHAT MESSAGE SCHEMA
/////////////////////////////////////////

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  id: z.uuid(),
  sessionId: z.string(),
  /**
   * @encrypted
   */
  parts: z.string(),
  createdAt: z.coerce.date(),
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>
