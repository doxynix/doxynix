import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { useMapCommands } from "./use-map-commands";
import { useMapControlsActions } from "./use-repo-map.store";

const MAP_PREFIXES = ["t", "z", "f"];

export type MapCommand = "fitView" | "focusSelected" | "toggleControls" | "zoomIn" | "zoomOut";

const COMMAND_BY_SECOND_KEY: Record<string, Record<string, MapCommand>> = {
  f: { s: "focusSelected", v: "fitView" },
  t: { c: "toggleControls" },
  z: { i: "zoomIn", o: "zoomOut" },
};

export function resolveMapCommand(prefix: string, code: string): MapCommand | null {
  const secondKey = code.startsWith("Key") ? code.slice(3).toLowerCase() : null;

  if (secondKey == null) {
    return null;
  }

  return COMMAND_BY_SECOND_KEY[prefix]?.[secondKey] ?? null;
}

export function useRepoMapHotkeys() {
  const { toggleControls } = useMapControlsActions();
  const map = useMapCommands();
  const [prefix, setPrefix] = useState<null | string>(null);

  useEffect(() => {
    if (prefix == null) {
      return;
    }
    const timer = setTimeout(() => setPrefix(null), 1000);
    return () => clearTimeout(timer);
  }, [prefix]);

  useHotkeys(MAP_PREFIXES.join(","), (_, handler) => setPrefix(handler.hotkey), {
    enabled: prefix == null,
    preventDefault: true,
  });

  useHotkeys(
    "*",
    (e) => {
      if (prefix == null) {
        return;
      }

      const command = resolveMapCommand(prefix, e.code);
      if (command == null) {
        setPrefix(null);
        return;
      }

      const commandHandlers: Record<MapCommand, () => void> = {
        fitView: map.fitView,
        focusSelected: map.focusSelected,
        toggleControls,
        zoomIn: map.zoomIn,
        zoomOut: map.zoomOut,
      };

      e.stopPropagation();
      commandHandlers[command]();
      setPrefix(null);
    },
    { enabled: prefix != null, preventDefault: true },
  );
}
