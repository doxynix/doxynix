import { useHotkeys } from "react-hotkeys-hook";

import {
  formatSequence,
  GLOBAL_HOTKEY_SCOPE,
  SHORTCUTS,
  toHotkeySequence,
} from "@/shared/config/shortcuts";
import { useSingleKeyShortcuts } from "@/shared/lib/hooks/use-single-key-shortcuts";

import { useMapCommands } from "./use-map-commands";
import { useMapControlsActions } from "./use-repo-map.store";

export type MapCommand = "fitView" | "focusSelected" | "toggleControls" | "zoomIn" | "zoomOut";

const MAP_COMMANDS = [
  "fitView",
  "focusSelected",
  "toggleControls",
  "zoomIn",
  "zoomOut",
] as const satisfies readonly MapCommand[];

export function createMapCommands(): Map<string, MapCommand> {
  const commands = new Map<string, MapCommand>();

  for (const command of MAP_COMMANDS) {
    const sequence = toHotkeySequence(SHORTCUTS[command].keys);
    if (sequence == null) {
      continue;
    }

    commands.set(sequence, command);
  }

  return commands;
}

const MAP_COMMANDS_BY_SEQUENCE = createMapCommands();
const MAP_HOTKEYS = [...MAP_COMMANDS_BY_SEQUENCE.keys()].join(",");

export const MAP_SHORTCUT_LABELS: Record<MapCommand, string> = {
  fitView: formatSequence(SHORTCUTS.fitView.keys),
  focusSelected: formatSequence(SHORTCUTS.focusSelected.keys),
  toggleControls: formatSequence(SHORTCUTS.toggleControls.keys),
  zoomIn: formatSequence(SHORTCUTS.zoomIn.keys),
  zoomOut: formatSequence(SHORTCUTS.zoomOut.keys),
};

export function resolveMapCommand(prefix: string, code: string): MapCommand | null {
  const secondKey = code.startsWith("Key") ? code.slice(3).toLowerCase() : null;

  if (secondKey == null) {
    return null;
  }

  return MAP_COMMANDS_BY_SEQUENCE.get(`${prefix}>${secondKey}`) ?? null;
}

export function useRepoMapHotkeys() {
  const { toggleControls } = useMapControlsActions();
  const map = useMapCommands();
  const singleKeyShortcuts = useSingleKeyShortcuts();

  useHotkeys(
    MAP_HOTKEYS,
    (event, handler) => {
      const command = MAP_COMMANDS_BY_SEQUENCE.get(handler.hotkey);
      if (command == null) {
        return;
      }

      const commandHandlers: Record<MapCommand, () => void> = {
        fitView: map.fitView,
        focusSelected: map.focusSelected,
        toggleControls,
        zoomIn: map.zoomIn,
        zoomOut: map.zoomOut,
      };

      event.stopPropagation();
      commandHandlers[command]();
    },
    {
      enabled: singleKeyShortcuts,
      enableOnFormTags: false,
      preventDefault: true,
      scopes: GLOBAL_HOTKEY_SCOPE,
      sequenceTimeoutMs: 1000,
    },
  );
}
