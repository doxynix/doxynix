import { useHotkeys } from "react-hotkeys-hook";

import { GLOBAL_HOTKEY_SCOPE, SHORTCUTS } from "@/shared/config/shortcuts";

import { useShortLinksDialogActions } from "./use-short-links-dialog.store";

export function useShortLinksHotkey() {
  const { setOpen } = useShortLinksDialogActions();

  useHotkeys(
    SHORTCUTS.shortLinks.keys,
    (event) => {
      if (event.repeat) {
        return;
      }

      setOpen(true);
    },
    {
      enableOnFormTags: false,
      preventDefault: true,
      scopes: GLOBAL_HOTKEY_SCOPE,
      useKey: true,
    },
  );
}
