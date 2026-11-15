"use client";

import { useCreateRepoOpen } from "@/entities/repo/model/use-create-repo-dialog.store";

import { useCommandMenuIsOpen } from "@/features/command-menu/model/use-command-menu.store";
import { useShortLinksDialogIsOpen } from "@/features/short-links/model/use-short-links-dialog.store";
import { useShortLinksHotkey } from "@/features/short-links/model/use-short-links-hotkey";
import { ShortLinksDialog } from "@/features/short-links/ui/short-links-dialog";
import { useShortcutsHotkey } from "@/features/shortcuts/model/use-shortcuts-hotkey";
import { ShortcutsDialog } from "@/features/shortcuts/ui/shortcuts-dialog";

import { useGlobalActionsHotkeys } from "../model/use-actions-hotkeys";
import { useLayoutHotkeys } from "../model/use-layout-hotkeys";
import { useNavigationHotkeys } from "../model/use-navigation-hotkeys";
import { useOverlayHotkeyScope } from "../model/use-overlay-hotkey-scope";

export function HotkeyListeners() {
  const commandMenuOpen = useCommandMenuIsOpen();
  const createRepoOpen = useCreateRepoOpen();
  const shortLinksOpen = useShortLinksDialogIsOpen();

  useNavigationHotkeys();
  useGlobalActionsHotkeys();
  useLayoutHotkeys();
  useOverlayHotkeyScope();
  useShortcutsHotkey(!commandMenuOpen && !createRepoOpen && !shortLinksOpen);
  useShortLinksHotkey();

  return (
    <>
      <ShortcutsDialog />
      <ShortLinksDialog />
    </>
  );
}
