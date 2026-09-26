import { randomBytes } from "node:crypto";

const scheme = "k1";
const cipher = "aesgcm256";
const key = randomBytes(32).toString("base64url");

process.env.PRISMA_FIELD_ENCRYPTION_KEY = `${scheme}.${cipher}.${key}`;
// Ably's Rest client throws "invalid key parameter" at construction time unless
// the key is `<appId>.<keyId>:<keySecret>`. A bare string is rejected, which made
// every test that transitively imports server/core/realtime (via core/db) fail to
// even load. The value is never used to reach Ably in tests.
process.env.ABLY_API_KEY ??= "local.test:abcdefghijklmnopqrstuvwxyz012345";
process.env.LOG_SALT_SECRET ??= "test-log-salt-secret";
