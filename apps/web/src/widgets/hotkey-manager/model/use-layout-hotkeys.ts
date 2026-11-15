import { useHotkeys } from "react-hotkeys-hook";

import { GLOBAL_HOTKEY_SCOPE, SHORTCUTS } from "@/shared/config/shortcuts";
import { useSidebar } from "@/shared/ui/core/sidebar";

import { useCommandMenuActions } from "@/features/command-menu/model/use-command-menu.store";

export function useLayoutHotkeys() {
  const { toggleSidebar } = useSidebar();
  const { toggle: toggleCommandMenu } = useCommandMenuActions();

  const options = {
    enableOnContentEditable: true,
    enableOnFormTags: true,
    preventDefault: true,
    scopes: GLOBAL_HOTKEY_SCOPE,
  };

  useHotkeys(
    SHORTCUTS.toggleSidebar.keys,
    (e) => {
      if (e.repeat) {
        return;
      }
      toggleSidebar();
    },
    options,
  );

  useHotkeys(
    SHORTCUTS.commandMenu.keys,
    (e) => {
      if (e.repeat) {
        return;
      }
      toggleCommandMenu();
    },
    options,
  );
}
