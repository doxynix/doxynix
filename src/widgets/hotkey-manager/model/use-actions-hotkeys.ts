import { useHotkeys } from "react-hotkeys-hook";

import { useCreateRepoActions } from "@/entities/repo";

export function useActionsHotkeys() {
  const { setOpen } = useCreateRepoActions();

  const hotkeyActions: Record<string, () => void> = {
    "c>n": () => setOpen(true),
    // сюда добавляются новые действия
  };

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
