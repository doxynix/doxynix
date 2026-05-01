import { randomBytes } from "node:crypto";

if (!process.env.PRISMA_FIELD_ENCRYPTION_KEY) {
  const prefix = "k1.aesgcm256.";
  const key = randomBytes(32).toString("base64");
  process.env.PRISMA_FIELD_ENCRYPTION_KEY = prefix + key;
}
