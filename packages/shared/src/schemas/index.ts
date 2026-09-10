import * as z from "zod/mini";

import {
  NotifyTypeSchema,
  PRCommentStyleSchema,
  PRFocusAreaSchema,
  StatusSchema,
  UserRoleSchema,
  VisibilitySchema,
} from "../enums";

export const AuthSchema = z.object({
  email: z.email({
    error: "Enter a valid email address",
  }),
  password: z.string().check(
    z.minLength(8, {
      error: "Password must be at least 8 characters long",
    }),
  ),
});

export type AuthSchemaInput = z.infer<typeof AuthSchema>;

export const CreateApiKeySchema = z.object({
  description: z.optional(
    z.string().check(
      z.trim(),
      z.maxLength(1000, {
        error: "Description too long",
      }),
    ),
  ),
  name: z.string().check(
    z.trim(),
    z.minLength(1, {
      error: "Name must be at least 1 character",
    }),
    z.maxLength(50, {
      error: "Name cannot exceed 50 characters",
    }),
  ),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;

export const UpdatePRConfigInput = z.object({
  ciSkip: z.optional(z.boolean()),
  commentStyle: z.optional(PRCommentStyleSchema),
  enabled: z.optional(z.boolean()),
  focusAreas: z.optional(z.array(PRFocusAreaSchema)),
  repoId: z.string(),
  tokenBudget: z.optional(z.number().check(z.int(), z.gte(10_000), z.lte(100_000))),
});

export type UpdatePRConfigInputValues = z.infer<typeof UpdatePRConfigInput>;

export const CreatePrSchema = z.object({
  branchName: z.string().check(
    z.minLength(1, {
      error: "Branch name is required",
    }),
    z.regex(/^[\w./-]+$/, {
      error: "Invalid branch name format",
    }),
  ),
  prTitle: z.string().check(
    z.minLength(5, {
      error: "PR title must be at least 5 characters",
    }),
    z.maxLength(100, {
      error: "Title is too long",
    }),
  ),
});

export type CreatePrValues = z.infer<typeof CreatePrSchema>;

export const CreateRepoSchema = z.object({
  url: z.string().check(
    z.trim(),
    z.minLength(1, {
      error: "URL cannot be empty",
    }),
    z.maxLength(500, {
      error: "URL too long",
    }),
  ),
});

export const GitHubQuerySchema = z.object({
  query: z.string().check(
    z.trim(),
    z.minLength(2, {
      error: "Min 2 chars",
    }),
    z.maxLength(256, {
      error: "Query too long",
    }),
  ),
});

export type CreateRepoInput = z.infer<typeof CreateRepoSchema>;

export const UpdateProfileSchema = z.object({
  email: z.optional(
    z
      .email({
        error: "Please enter a valid email address",
      })
      .check(
        z.maxLength(254, {
          error: "Email address cannot exceed 254 characters",
        }),
      ),
  ),
  name: z.string().check(
    z.trim(),
    z.minLength(1, {
      error: "Name must be at least 1 character",
    }),
    z.maxLength(50, {
      error: "Name cannot exceed 50 characters",
    }),
  ),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const PublicUserSchema = z.object({
  createdAt: z.coerce.date(),
  email: z.nullable(z.email()),
  emailVerified: z.boolean(),
  id: z.uuid(),
  image: z.nullable(z.string()),
  name: z.nullable(z.string()),
  role: UserRoleSchema,
  updatedAt: z.coerce.date(),
});

export type PublicUser = z.infer<typeof PublicUserSchema>;

export const PublicRepoSchema = z.object({
  createdAt: z.coerce.date(),
  defaultBranch: z.string(),
  description: z.nullable(z.string()),
  forks: z.number().check(z.int(), z.gte(0)),
  githubCreatedAt: z.nullable(z.coerce.date()),
  githubId: z.number().check(z.int()),
  id: z.uuid(),
  language: z.nullable(z.string()),
  license: z.nullable(z.string()),
  name: z.string(),
  openIssues: z.number().check(z.int(), z.gte(0)),
  owner: z.string(),
  ownerAvatarUrl: z.nullable(z.string()),
  pushedAt: z.nullable(z.coerce.date()),
  size: z.number().check(z.int(), z.gte(0)),
  stars: z.number().check(z.int(), z.gte(0)),
  status: z._default(StatusSchema, "NEW"),
  topics: z.array(z.string()),
  updatedAt: z.coerce.date(),
  url: z.url(),
  visibility: VisibilitySchema,
});

export type PublicRepo = z.infer<typeof PublicRepoSchema>;

export const NotificationSchema = z.object({
  body: z.string(),
  createdAt: z.coerce.date(),
  id: z.uuid(),
  isRead: z.boolean(),
  repo: z.nullable(
    z.object({
      name: z.string(),
      owner: z.string(),
    }),
  ),
  title: z.string(),
  type: NotifyTypeSchema,
  updatedAt: z.coerce.date(),
});

export type Notification = z.infer<typeof NotificationSchema>;

export const ApiKeySchema = z.object({
  createdAt: z.coerce.date(),
  description: z.nullable(z.string()),
  id: z.uuid(),
  lastUsed: z.nullable(z.coerce.date()),
  name: z.string(),
  prefix: z.string(),
  revoked: z.boolean(),
  updatedAt: z.coerce.date(),
});
export type ApiKey = z.infer<typeof ApiKeySchema>;
