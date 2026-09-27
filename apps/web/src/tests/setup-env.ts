import { randomBytes } from "node:crypto";

const scheme = "k1";
const cipher = "aesgcm256";
const key = randomBytes(32).toString("base64url");

process.env.PRISMA_FIELD_ENCRYPTION_KEY = `${scheme}.${cipher}.${key}`;
process.env.ABLY_API_KEY ??= "local.test:abcdefghijklmnopqrstuvwxyz012345";
process.env.LOG_SALT_SECRET ??= "test-log-salt-secret";
process.env.API_KEY_CHECKSUM_SECRET ??= "test-api-key-checksum-secret";
process.env.API_KEY_PEPPER ??= "test-api-key-pepper";
