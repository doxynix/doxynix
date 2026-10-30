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
      workspace: "Workspace",
    },
    fields: {},
  },
  BannedEmail: {
    connections: {},
    fields: {
      email: { hash: { normalize: ["lowercase", "trim"] } },
    },
  },
  BillingCheckoutSession: {
    connections: {
      workspace: "Workspace",
    },
    fields: {},
  },
  BillingCustomer: {
    connections: {
      subscriptions: "BillingSubscription",
      workspace: "Workspace",
    },
    fields: {},
  },
  BillingEvent: {
    connections: {
      ledgerEntries: "BillingLedgerEntry",
    },
    fields: {},
  },
  BillingIssue: {
    connections: {
      workspace: "Workspace",
    },
    fields: {},
  },
  BillingLedgerEntry: {
    connections: {
      billingEvent: "BillingEvent",
      corrections: "BillingLedgerEntry",
      corrects: "BillingLedgerEntry",
      workspace: "Workspace",
    },
    fields: {},
  },
  BillingOperation: {
    connections: {
      actor: "User",
      workspace: "Workspace",
    },
    fields: {},
  },
  BillingSubscription: {
    connections: {
      billingCustomer: "BillingCustomer",
      workspace: "Workspace",
    },
    fields: {},
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
      workspace: "Workspace",
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
      createdBy: "User",
      documents: "Document",
      generatedFixes: "GeneratedFix",
      notifications: "Notification",
      prAnalysisConfig: "PullRequestAnalysisConfig",
      pullRequests: "PullRequestAnalysis",
      workspace: "Workspace",
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
      appearance: "UserAppearance",
      billingOperations: "BillingOperation",
      chatSession: "ChatSession",
      createdRepos: "Repo",
      githubInstallations: "GithubInstallation",
      notifications: "Notification",
      passkeys: "Passkey",
      sessions: "Session",
      twoFactors: "TwoFactor",
      workspaceMemberships: "WorkspaceMember",
    },
    fields: {
      email: { hash: { normalize: ["lowercase", "trim"] } },
    },
  },
  UserAppearance: {
    connections: {
      user: "User",
    },
    fields: {},
  },
  Verification: {
    connections: {},
    fields: {
      identifier: { hash: { normalize: ["lowercase", "trim"] } },
      value: { hash: { normalize: [] } },
    },
  },
  Workspace: {
    connections: {
      apiKeys: "ApiKey",
      billingCheckoutSessions: "BillingCheckoutSession",
      billingCustomers: "BillingCustomer",
      billingIssues: "BillingIssue",
      billingLedgerEntries: "BillingLedgerEntry",
      billingOperations: "BillingOperation",
      billingSubscriptions: "BillingSubscription",
      entitlement: "WorkspaceEntitlement",
      githubInstallations: "GithubInstallation",
      members: "WorkspaceMember",
      repos: "Repo",
    },
    fields: {},
  },
  WorkspaceEntitlement: {
    connections: {
      workspace: "Workspace",
    },
    fields: {},
  },
  WorkspaceMember: {
    connections: {
      user: "User",
      workspace: "Workspace",
    },
    fields: {},
  },
};
