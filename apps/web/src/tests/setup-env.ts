import { randomBytes } from "node:crypto";

const scheme = "k1";
const cipher = "aesgcm256";
const key = randomBytes(32).toString("base64url");

process.env.PRISMA_FIELD_ENCRYPTION_KEY = `${scheme}.${cipher}.${key}`;
process.env.BILLING_LOCAL_UPGRADE_ENABLED ??= "true";
process.env.STRIPE_API_KEY ??= "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_placeholder";
process.env.STRIPE_PRICE_PRO_MONTHLY_USD ??= "price_placeholder_pro_monthly_usd";
process.env.STRIPE_LIVEMODE ??= "false";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.ABLY_API_KEY ??= "local.test:abcdefghijklmnopqrstuvwxyz012345";
process.env.LOG_SALT_SECRET ??= "test-log-salt-secret";
process.env.API_KEY_CHECKSUM_SECRET ??= "test-api-key-checksum-secret";
process.env.API_KEY_PEPPER ??= "test-api-key-pepper";
