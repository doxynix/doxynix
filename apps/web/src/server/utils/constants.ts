export const ENCRYPTED_METADATA_MAP: Record<string, Record<string, string>> = {
  Account: {
    accessToken: "/// @encrypted",
    email: "/// @encrypted",
    emailHash: "/// @encryption:hash(email)?normalize=lowercase&normalize=trim",
    idToken: "/// @encrypted",
    refreshToken: "/// @encrypted",
  },
  BannedEmail: {
    email: "/// @encrypted",
    emailHash: "/// @encryption:hash(email)?normalize=lowercase&normalize=trim",
  },
  ChatMessage: {
    parts: "/// @encrypted",
  },
  Document: {
    content: "/// @encrypted",
  },
  Session: {
    token: "/// @encrypted",
    tokenHash: "/// @encryption:hash(token)",
  },
  User: {
    email: "/// @encrypted",
    emailHash: "/// @encryption:hash(email)?normalize=lowercase&normalize=trim",
    name: "/// @encrypted",
  },
  Verification: {
    identifier: "/// @encrypted",
    identifierHash: "/// @encryption:hash(identifier)?normalize=lowercase&normalize=trim",
    value: "/// @encrypted",
    valueHash: "/// @encryption:hash(value)",
  },
};

export const AUDIT_BUSINESS_MODELS = [
  "Repo",
  "ApiKey",
  "User",
  "Analysis",
  "PullRequestAnalysis",
  "PullRequestAnalysisConfig",
  "PullRequestComment",
  "GeneratedFix",
  "GithubInstallation",
  "Document",
  "Account",
  "BannedEmail",
  "ChatSession",
];
