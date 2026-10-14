---
name: better-auth-security-best-practices
description: Configure rate limiting, manage auth secrets, set up CSRF protection, define trusted origins, secure sessions and cookies, encrypt OAuth tokens, track IP addresses, and implement audit logging for Better Auth. Use when users need to secure their auth setup, prevent brute force attacks, or harden a Better Auth deployment.
---

## Doxynix context

Better Auth **1.6.30**, configured in two places:

| | `apps/siem-server` | `apps/web` |
|---|---|---|
| Config | `src/core/auth/auth.ts` | `src/server/core/auth/index.ts` |
| Secrets from | `env.BETTER_AUTH_SECRET` (`@/core/env`) | `BETTER_AUTH_SECRET` (`@/shared/config/env.server`) |
| Base URL from | `env.BETTER_AUTH_URL` | `BETTER_AUTH_URL` |
| Cookie prefix | `doxynix-siem` | default |
| Redis | ioredis / Valkey | `@upstash/redis` + `@upstash/ratelimit` |

**Never read `process.env` for secrets.** Both apps expose validated env modules — a direct
`process.env.BETTER_AUTH_SECRET` bypasses validation and fails the env-schema checks.

All runtime secrets are injected by Doppler through each workspace's `with-doppler` helper; `CI=true`
passes straight through.

## Secret Management

### Configuring the Secret

```ts
import { betterAuth } from "better-auth";
import { BETTER_AUTH_SECRET } from "@/shared/config/env.server"; // apps/web
// import { BETTER_AUTH_SECRET } from "@/core/env";              // apps/siem-server

export const auth = betterAuth({
  secret: BETTER_AUTH_SECRET,
});
```

Better Auth looks for secrets in this order:
1. `options.secret` in your config
2. `BETTER_AUTH_SECRET` environment variable
3. `AUTH_SECRET` environment variable

### Secret Requirements

- Rejects default/placeholder secrets in production
- Warns if shorter than 32 characters or entropy below 120 bits
- Generate: `openssl rand -base64 32`
- Never commit secrets to version control — `bun run secretlint` runs in pre-commit

## Rate Limiting

Enabled in production by default. Applies to all endpoints. Plugins can override per-endpoint.

`apps/web` additionally rate-limits sign-in with `@upstash/ratelimit` in
`src/server/core/ratelimit.ts` (`Ratelimit.slidingWindow(3, "10 m")`, prefix
`@doxynix/ratelimit/email`, `enableProtection: true`) and in `src/proxy.ts`. Prefer those over
Better Auth's built-in limiter for user-facing flows. See the `upstash-redis-js` skill.

### Default Configuration

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  rateLimit: {
    enabled: true, // Default: true in production
    window: 10, // Time window in seconds (default: 10)
    max: 100, // Max requests per window (default: 100)
  },
});
```

### Storage Options

Options: `"memory"` (resets on restart, avoid on serverless), `"database"` (persistent), `"secondary-storage"` (Redis, default when available).

```ts
rateLimit: {
  storage: "database",
}
```

### Custom Storage

Implement your own rate limit storage:

```ts
rateLimit: {
  customStorage: {
    get: async (key) => {
      // Return { count: number, expiresAt: number } or null
    },
    set: async (key, data) => {
      // Store the rate limit data
    },
  },
}
```

### Per-Endpoint Rules

Sensitive endpoints default to 3 requests per 10 seconds (`/sign-in`, `/sign-up`, `/change-password`, `/change-email`). Override:

```ts
rateLimit: {
  customRules: {
    "/api/auth/sign-in/email": {
      window: 60, // 1 minute window
      max: 5, // 5 attempts
    },
    "/api/auth/some-safe-endpoint": false, // Disable rate limiting
  },
}
```

## CSRF Protection

Multi-layer protection: origin header validation, Fetch Metadata checks, and first-login protection.

### Configuration

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  advanced: {
    disableCSRFCheck: false, // Default: false (keep enabled)
  },
});
```

Only disable for testing or with an alternative CSRF mechanism.

## Trusted Origins

### Configuring Trusted Origins

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  baseURL: "https://api.example.com",
  trustedOrigins: [
    "https://app.example.com",
    "https://admin.example.com",
  ],
});
```

The `baseURL` origin is automatically trusted. Also configurable via env: `BETTER_AUTH_TRUSTED_ORIGINS=https://app.example.com,https://admin.example.com`

### Wildcard Patterns

```ts
trustedOrigins: [
  "*.example.com", // Matches any subdomain
  "https://*.example.com", // Protocol-specific wildcard
]
```

`apps/siem-server` pins `trustedOrigins` to `env.CLIENT_URL` plus explicit localhost/127.0.0.1
entries on port 3001. Keep that shape — do not widen it with a wildcard.

### Dynamic Trusted Origins

Compute trusted origins based on the request:

```ts
trustedOrigins: async (request) => {
  // Validate against database, header, etc.
  const tenant = getTenantFromRequest(request);
  return [`https://${tenant}.myapp.com`];
}
```

Validates `callbackURL`, `redirectTo`, `errorCallbackURL`, `newUserCallbackURL`, and `origin` against trusted origins. Invalid URLs receive 403.

## Session Security

### Session Expiration

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days (default)
    updateAge: 60 * 60 * 24, // Refresh session every 24 hours (default)
  },
});
```

### Session Caching Strategies

Cache session data in cookies to reduce database queries:

```ts
session: {
  cookieCache: {
    enabled: true,
    maxAge: 60 * 5, // 5 minutes
    strategy: "compact", // Options: "compact", "jwt", "jwe"
  },
}
```

Strategies: `"compact"` (Base64url + HMAC, smallest), `"jwt"` (HS256, standard), `"jwe"` (encrypted, use when session has sensitive data).

## Cookie Security

Defaults: `secure: true` (HTTPS/production), `sameSite: "lax"`, `httpOnly: true`, `path: "/"`, prefix `__Secure-`.

### Custom Cookie Configuration

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  advanced: {
    useSecureCookies: true, // Force secure cookies
    cookiePrefix: "myapp", // Custom prefix (default: "better-auth")
    defaultCookieAttributes: {
      sameSite: "strict", // Stricter CSRF protection
      path: "/auth", // Limit cookie scope
    },
  },
});
```

### Cross-Subdomain Cookies

```ts
advanced: {
  crossSubDomainCookies: {
    enabled: true,
    domain: ".example.com", // Note the leading dot
    additionalCookies: ["session_token", "session_data"],
  },
}
```

Only enable if you need authentication sharing and trust all subdomains.

## OAuth / Social Provider Security

PKCE is automatic for all OAuth flows. State tokens are 32-char random strings expiring after 10 minutes.

### State Parameter Storage

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  account: {
    storeStateStrategy: "cookie", // Options: "cookie" (default), "database"
  },
});
```

### Encrypting OAuth Tokens

```ts
account: {
  encryptOAuthTokens: true, // Uses AES-256-GCM
}
```

Enable if storing OAuth tokens for API access on behalf of users. `apps/web` uses the `genericOAuth`
plugin — keep the client secret and any stored token out of client-reachable code.

## IP-Based Security

### IP Address Configuration

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"], // Headers to check
      disableIpTracking: false, // Keep enabled for rate limiting
    },
  },
});
```

Set `ipv6Subnet` (128, 64, 48, 32; default 64) to group IPv6 addresses. Enable `trustedProxyHeaders: true` only if behind a trusted reverse proxy.

## Database Hooks for Security Auditing

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  databaseHooks: {
    session: {
      create: {
        after: async ({ data, ctx }) => {
          await auditLog("session.created", {
            userId: data.userId,
            ip: ctx?.request?.headers.get("x-forwarded-for"),
            userAgent: ctx?.request?.headers.get("user-agent"),
          });
        },
      },
      delete: {
        before: async ({ data }) => {
          await auditLog("session.revoked", { sessionId: data.id });
        },
      },
    },
    user: {
      update: {
        after: async ({ data, oldData }) => {
          if (oldData?.email !== data.email) {
            await auditLog("user.email_changed", {
              userId: data.id,
              oldEmail: oldData?.email,
              newEmail: data.email,
            });
          }
        },
      },
    },
    account: {
      create: {
        after: async ({ data }) => {
          await auditLog("account.linked", {
            userId: data.userId,
            provider: data.providerId,
          });
        },
      },
    },
  },
});
```

Return `false` from a `before` hook to prevent an operation.

## Background Tasks

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  advanced: {
    backgroundTasks: {
      handler: (promise) => {
        // apps/web: hand off to Next.js after()
        after(() => promise);
      },
    },
  },
});
```

Ensures operations like sending emails don't affect response timing. `apps/web` already imports
`after` from `next/server`; `apps/siem-server` runs on Node/Bun and needs no handler.

## Account Enumeration Prevention

Built-in: consistent response messages, dummy operations on invalid requests, background email sending. Return generic error messages ("Invalid credentials") rather than specific ones ("User not found").

## Complete Security Configuration Example

Shapes from the two configs in this repo, merged. Audit hooks use `appLogger`, not `console` —
Oxlint's `no-console` only allows `warn` / `error` / `info`.

```ts
import { after } from "next/server";
import { betterAuth } from "better-auth";

import { BETTER_AUTH_SECRET, BETTER_AUTH_URL, CLIENT_URL } from "@/shared/config/env.server";

export const auth = betterAuth({
  baseUrl: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,
  trustedOrigins: [...CLIENT_URL],

  // Rate limiting
  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    customRules: {
      "/api/auth/sign-in/email": { window: 60, max: 5 },
      "/api/auth/sign-up/email": { window: 60, max: 3 },
    },
  },

  // Session security — apps/web uses 30 days
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 60,
  },

  // OAuth security
  account: {
    encryptOAuthTokens: true,
    storeStateStrategy: "cookie",
  },

  advanced: {
    useSecureCookies: true,
    database: { generateId: false },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for"],
      ipv6Subnet: 64,
    },
    backgroundTasks: {
      handler: (promise) => after(() => promise),
    },
  },

  // Security auditing
  databaseHooks: {
    session: {
      create: {
        after: async ({ data }) => {
          appLogger.info({ msg: "New session", userId: data.userId });
        },
      },
    },
  },
});
```

## Security Checklist

Before deploying to production:

- [ ] **Secret**: strong, unique, ≥32 chars, high entropy, read from a validated env module
- [ ] **HTTPS**: `baseURL` uses HTTPS
- [ ] **Trusted Origins**: explicit list, no wildcards in production
- [ ] **Rate Limiting**: enabled, plus the `@upstash/ratelimit` limiter in `apps/web`
- [ ] **CSRF Protection**: `disableCSRFCheck` left `false`
- [ ] **Secure Cookies**: HTTPS in production
- [ ] **OAuth Tokens**: `encryptOAuthTokens: true` when tokens are persisted
- [ ] **Background Tasks**: `after()` handler in `apps/web`
- [ ] **Audit Logging**: `databaseHooks` / `hooks`, logging via `appLogger`
- [ ] **IP Tracking**: proxy headers configured in `src/proxy.ts`
- [ ] **Gates**: `bun run secretlint` and `bun run spellcheck` pass
