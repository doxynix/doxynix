import { randomBytes } from "node:crypto";

const scheme = "k1";
const cipher = "aesgcm256";
const key = randomBytes(32).toString("base64url");

process.env.PRISMA_FIELD_ENCRYPTION_KEY = `${scheme}.${cipher}.${key}`;
