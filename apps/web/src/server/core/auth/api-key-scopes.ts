import { ApiKeyScope } from "@doxynix/shared";

export function hasApiKeyScope(scopes: string[] | undefined, required: ApiKeyScope): boolean {
  if (scopes == null || scopes.length === 0) {
    return true;
  }

  return scopes.includes(ApiKeyScope.FULL) || scopes.includes(required);
}
