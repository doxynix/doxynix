// This file was automatically generated via Prisma DMMF. DO NOT EDIT MANUALLY.

export type FieldSpec = {
  hash?: {
    normalize: Array<"lowercase" | "trim">;
  };
};

export type ModelSpec = {
  connections: Record<string, string>;
  fields: Record<string, FieldSpec>;
};

export const FIELD_ENCRYPTION_SPEC: Record<string, ModelSpec> = {
  Account: {
    connections: {
      user: "User",
    },
    fields: {
      accessToken: {},
      email: { hash: { normalize: ["lowercase", "trim"] } },
      idToken: {},
      refreshToken: {},
    },
  },
  Analysis: {
    connections: {
      documents: "Document",
      repo: "Repo",
    },
    fields: {},
  },
  ApiKey: {
    connections: {
      user: "User",
    },
    fields: {},
  },
  BannedEmail: {
    connections: {},
    fields: {
      email: { hash: { normalize: ["lowercase", "trim"] } },
    },
  },
  ChatMessage: {
    connections: {
      session: "ChatSession",
    },
    fields: {
      parts: {},
    },
  },
  ChatSession: {
    connections: {
      messages: "ChatMessage",
      repo: "Repo",
      user: "User",
    },
    fields: {},
  },
  Document: {
    connections: {
      analysis: "Analysis",
      repo: "Repo",
    },
    fields: {
      content: {},
    },
  },
  GeneratedFix: {
    connections: {
      prAnalysis: "PullRequestAnalysis",
      repo: "Repo",
    },
    fields: {},
  },
  GithubInstallation: {
    connections: {
      user: "User",
    },
    fields: {},
  },
  Notification: {
    connections: {
      repo: "Repo",
      user: "User",
    },
    fields: {},
  },
  Passkey: {
    connections: {
      user: "User",
    },
    fields: {},
  },
  PullRequestAnalysis: {
    connections: {
      comments: "PullRequestComment",
      generatedFixes: "GeneratedFix",
      repo: "Repo",
    },
    fields: {},
  },
  PullRequestAnalysisConfig: {
    connections: {
      repo: "Repo",
    },
    fields: {},
  },
  PullRequestComment: {
    connections: {
      analysis: "PullRequestAnalysis",
    },
    fields: {},
  },
  Repo: {
    connections: {
      analyses: "Analysis",
      chatSessions: "ChatSession",
      documents: "Document",
      generatedFixes: "GeneratedFix",
      notifications: "Notification",
      prAnalysisConfig: "PullRequestAnalysisConfig",
      pullRequests: "PullRequestAnalysis",
      user: "User",
    },
    fields: {},
  },
  Session: {
    connections: {
      user: "User",
    },
    fields: {
      token: { hash: { normalize: [] } },
    },
  },
  TwoFactor: {
    connections: {
      user: "User",
    },
    fields: {},
  },
  User: {
    connections: {
      accounts: "Account",
      apiKeys: "ApiKey",
      chatSession: "ChatSession",
      githubInstallations: "GithubInstallation",
      notifications: "Notification",
      passkeys: "Passkey",
      repos: "Repo",
      sessions: "Session",
      twoFactors: "TwoFactor",
    },
    fields: {
      email: { hash: { normalize: ["lowercase", "trim"] } },
      name: {},
    },
  },
  Verification: {
    connections: {},
    fields: {
      identifier: { hash: { normalize: ["lowercase", "trim"] } },
      value: { hash: { normalize: [] } },
    },
  },
};
