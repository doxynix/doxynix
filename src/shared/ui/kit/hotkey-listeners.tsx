"use client";

import { useActionsHotkeys } from "@/shared/hooks/use-actions-hotkeys";
import { useNavigationHotkeys } from "@/shared/hooks/use-navigation-hotkeys";

export function HotkeyListeners() {
  useNavigationHotkeys();
  useActionsHotkeys();

  return null;
}
