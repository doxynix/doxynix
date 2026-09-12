import { brand } from "@/ui/colors";
import { renderCard } from "@/ui/layout";

import type { AuthUser } from "./auth.types";

export function renderUserProfile(user: AuthUser): void {
  console.log(
    renderCard("Current User Profile", [
      ["Name", brand.highlight(user.name ?? "Not set")],
      ["Email", brand.highlight(user.email ?? "Not set")],
      ["Role", brand.info(user.role)],
      ["ID (UUID)", brand.muted(user.id)],
    ]),
  );
}
