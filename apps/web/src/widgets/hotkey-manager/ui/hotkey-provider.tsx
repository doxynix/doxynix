"use client";

import type { ReactNode } from "react";
import { HotkeysProvider } from "react-hotkeys-hook";

import { GLOBAL_HOTKEY_SCOPE } from "@/shared/config/shortcuts";

export function HotkeyProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <HotkeysProvider initiallyActiveScopes={[GLOBAL_HOTKEY_SCOPE]}>{children}</HotkeysProvider>
  );
}
