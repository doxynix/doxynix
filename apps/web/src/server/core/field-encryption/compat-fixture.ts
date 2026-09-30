// Captured from `prisma-field-encryption@1.6.0` / `@47ng/cloak@1.2.0`: rows already in Postgres must keep decrypting after the library is removed.
export const COMPAT_FIXTURE = {
  ciphertext: "v1.aesgcm256.99d40d80.pECxCvDCniIr3GMv.lpG56LpltPWJF7KiJVD7Zb8hRALqv-XvM3jRurMwhHc=",
  fingerprint: "99d40d80",
  KEY: "k1.aesgcm256.MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY",
  plaintext: "user@example.com",
  rawKey: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY",
} as const;
