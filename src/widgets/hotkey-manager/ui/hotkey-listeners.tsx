"use client";

import { useActionsHotkeys } from "../model/use-actions-hotkeys";
import { useNavigationHotkeys } from "../model/use-navigation-hotkeys";

export function HotkeyListeners() {
  useNavigationHotkeys();
  useActionsHotkeys();

  return null;
}
