import { useHotkeys } from "react-hotkeys-hook";

import { GLOBAL_HOTKEY_SCOPE, SHORTCUTS, toHotkeySequence } from "@/shared/config/shortcuts";
import { useSingleKeyShortcuts } from "@/shared/lib/hooks/use-single-key-shortcuts";

import { useCreateRepoActions } from "@/entities/repo/model/use-create-repo-dialog.store";

export type GlobalHotkeyCommand = "createRepo";

export type SequenceResult =
  | { action: "execute"; command: GlobalHotkeyCommand }
  | { action: "reset" }
  | { action: "ignore" };

export function createActionCommands(): Map<string, GlobalHotkeyCommand> {
  const commands = new Map<string, GlobalHotkeyCommand>();
  const sequence = toHotkeySequence(SHORTCUTS.createRepo.keys);

  if (sequence != null) {
    commands.set(sequence, "createRepo");
  }

  return commands;
}

const ACTION_COMMANDS = createActionCommands();
const ACTION_HOTKEYS = [...ACTION_COMMANDS.keys()].join(",");

export function processGlobalHotkeySequence(prefix: string | null, code: string): SequenceResult {
  if (prefix == null) {
    return { action: "ignore" };
  }

  const secondKey = code.startsWith("Key") ? code.slice(3).toLowerCase() : null;
  if (secondKey == null) {
    return { action: "reset" };
  }

  const command = ACTION_COMMANDS.get(`${prefix}>${secondKey}`);
  if (command == null) {
    return { action: "reset" };
  }

  return { action: "execute", command };
}

export function useGlobalActionsHotkeys(onAction?: () => void) {
  const { setOpen } = useCreateRepoActions();
  const singleKeyShortcuts = useSingleKeyShortcuts();

  useHotkeys(
    ACTION_HOTKEYS,
    (event, handler) => {
      if (ACTION_COMMANDS.get(handler.hotkey) !== "createRepo") {
        return;
      }

      event.stopPropagation();
      onAction?.();
      setTimeout(() => setOpen(true), 10);
    },
    {
      enabled: singleKeyShortcuts,
      enableOnFormTags: false,
      preventDefault: true,
      scopes: GLOBAL_HOTKEY_SCOPE,
      sequenceTimeoutMs: 1500,
    },
  );
}
