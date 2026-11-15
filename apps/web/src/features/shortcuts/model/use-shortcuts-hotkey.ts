import { useHotkeys } from "react-hotkeys-hook";

import { SHORTCUTS } from "@/shared/config/shortcuts";

import { useShortcutsDialogActions } from "./use-shortcuts-dialog.store";

export function useShortcutsHotkey(enabled = true) {
  const { toggle } = useShortcutsDialogActions();

  useHotkeys(
    SHORTCUTS.shortcutsHelp.keys,
    (event) => {
      if (event.repeat) {
        return;
      }

      toggle();
    },
    { enabled, enableOnFormTags: false, preventDefault: true, useKey: true },
  );
}
