export type ApiKeyState = {
  expiresAt: Date | null;
  revoked: boolean;
  revokedAfter: Date | null;
};

export function isApiKeyDead(key: ApiKeyState, now: number): boolean {
  if (key.revokedAfter != null) {
    return key.revokedAfter.getTime() <= now;
  }

  if (key.revoked) {
    return true;
  }

  return key.expiresAt != null && key.expiresAt.getTime() <= now;
}
