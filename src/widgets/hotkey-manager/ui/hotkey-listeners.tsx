"use client";

import { useActionsHotkeys } from "../model/use-actions-hotkeys";
import { useLayoutHotkeys } from "../model/use-layout-hotkeys";
import { useNavigationHotkeys } from "../model/use-navigation-hotkeys";

export function HotkeyListeners() {
  useNavigationHotkeys();
  useActionsHotkeys();
  useLayoutHotkeys();

  return null;
}
