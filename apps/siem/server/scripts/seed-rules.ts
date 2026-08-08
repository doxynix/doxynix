import { db } from "@server/core/db/db";
import { rules } from "@server/core/db/schema";

const defaultScanningRules = [
  {
    name: "Credit Card Leak",
    description: "Detects Visa, Mastercard, AMEX credit card numbers in logs",
    severity: "critical" as const,
    pattern: "\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\\b",
    isActive: true,
  },
  {
    name: "AWS Secret Access Key",
    description: "Detects exposed AWS Access and Secret Keys",
    severity: "critical" as const,
    pattern: "(aws_access_key_id|aws_secret_access_key)\\s*=\\s*['\"]?[A-Za-z0-9/+=]{20,40}['\"]?",
    isActive: true,
  },
  {
    name: "JWT Token Leak",
    description: "Detects exposed JSON Web Tokens in log lines",
    severity: "high" as const,
    pattern: "ey[A-Za-z0-9_-]{10,}\\.ey[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}",
    isActive: true,
  },
  {
    name: "RSA/OpenSSH Private Key",
    description: "Detects unencrypted Private Key headers",
    severity: "critical" as const,
    pattern: "-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----",
    isActive: true,
  },
  {
    name: "Generic API Token",
    description: "Detects generic API tokens with common prefixes (sk_live, ghp_, glpat-)",
    severity: "high" as const,
    pattern: "\\b(sk_live_[0-9a-zA-Z]{24}|ghp_[0-9a-zA-Z]{36}|glpat-[0-9a-zA-Z_-]{20})\\b",
    isActive: true,
  },
];

async function seedRules() {
  console.log("🌱 [Seed] Populating default SIEM scanning rules...");

  try {
    await db.insert(rules).values(defaultScanningRules).onConflictDoNothing({ target: rules.name });

    console.log("✅ [Seed] Scanning rules seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ [Seed] Failed to seed scanning rules:", error);
    process.exit(1);
  }
}

seedRules();
