import { brand } from "@/ui/colors";

import { type AuthUser } from "./auth.types";

export function renderUserProfile(user: AuthUser): void {
  console.log(`\n  Name:   ${brand.highlight(user.name ?? "Not set")}`);
  console.log(`  Email:  ${brand.highlight(user.email ?? "Not set")}`);
  console.log(`  Role:   ${brand.info(user.role)}`);
  console.log(`  ID:     ${brand.muted(user.id)}\n`);
}
