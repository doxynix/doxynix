import { useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { useCreateRepoDialogStore } from "@/features/repo";

export function useActionsHotkeys() {
  const { openDialog: openCreateRepoDialog } = useCreateRepoDialogStore();

  const hotkeyActions = useMemo(() => {
    const map: Record<string, () => void> = {
      "c>n": openCreateRepoDialog,
      // сюда добавляются новые действия
    };
    return map;
  }, [openCreateRepoDialog]);

  const hotkeys = Object.keys(hotkeyActions);

  return useHotkeys(
    hotkeys,
    (e, handler) => {
      const actionKey = handler.hotkey;
      const action = hotkeyActions[actionKey];

      e.preventDefault();
      action();
    },
    {
      enableOnFormTags: false,
      preventDefault: true,
      sequenceTimeoutMs: 1500,
    },
    [hotkeyActions]
  );
}
