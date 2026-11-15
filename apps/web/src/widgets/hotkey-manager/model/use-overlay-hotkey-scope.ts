import { useEffect } from "react";
import { useHotkeysContext } from "react-hotkeys-hook";

import { GLOBAL_HOTKEY_SCOPE } from "@/shared/config/shortcuts";

import { useCreateRepoOpen } from "@/entities/repo/model/use-create-repo-dialog.store";

import { useCommandMenuIsOpen } from "@/features/command-menu/model/use-command-menu.store";
import { useShortLinksDialogIsOpen } from "@/features/short-links/model/use-short-links-dialog.store";
import { useShortcutsDialogIsOpen } from "@/features/shortcuts/model/use-shortcuts-dialog.store";

export function useOverlayHotkeyScope() {
  const { activeScopes, disableScope, enableScope } = useHotkeysContext();
  const commandMenuOpen = useCommandMenuIsOpen();
  const createRepoOpen = useCreateRepoOpen();
  const shortLinksOpen = useShortLinksDialogIsOpen();
  const shortcutsOpen = useShortcutsDialogIsOpen();
  const overlayOpen = commandMenuOpen || createRepoOpen || shortLinksOpen || shortcutsOpen;
  const globalScopeActive = activeScopes.includes(GLOBAL_HOTKEY_SCOPE);

  useEffect(() => {
    if (overlayOpen && globalScopeActive) {
      disableScope(GLOBAL_HOTKEY_SCOPE);
      return;
    }

    if (!overlayOpen && !globalScopeActive) {
      enableScope(GLOBAL_HOTKEY_SCOPE);
    }
  }, [disableScope, enableScope, globalScopeActive, overlayOpen]);
}
