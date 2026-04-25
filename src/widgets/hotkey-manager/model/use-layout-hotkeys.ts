import { useHotkeys } from "react-hotkeys-hook";

import { useSidebar } from "@/shared/ui/core/sidebar";

import { useCommandMenuActions } from "@/entities/command-menu/model/use-command-menu.store";

export function useLayoutHotkeys() {
  const { toggleSidebar } = useSidebar();
  const { toggle: toggleCommandMenu } = useCommandMenuActions();

  const options = {
    enableOnContentEditable: true,
    enableOnFormTags: true,
    preventDefault: true,
  };

  useHotkeys(
    "mod+b",
    (e) => {
      if (e.repeat) return;
      toggleSidebar();
    },
    options
  );

  useHotkeys(
    "mod+k",
    (e) => {
      if (e.repeat) return;
      toggleCommandMenu();
    },
    options
  );
}
