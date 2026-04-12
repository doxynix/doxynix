import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { useMapCommands } from "./use-map-commands";
import { useMapControlsActions } from "./use-repo-map-store";

const MAP_PREFIXES = ["t", "z", "f"];

export function useRepoMapHotkeys() {
  const { toggleControls } = useMapControlsActions();
  const map = useMapCommands();
  const [prefix, setPrefix] = useState<null | string>(null);

  useEffect(() => {
    if (prefix == null) return;
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
      if (prefix == null) return;
      const code = e.code;
      const secondKey = code.startsWith("Key") ? code.slice(3).toLowerCase() : null;

      if (secondKey == null) {
        setPrefix(null);
        return;
      }

      const actions: Record<string, Record<string, () => void>> = {
        f: {
          s: map.focusSelected,
          v: map.fitView,
        },
        t: { c: toggleControls },
        z: {
          i: map.zoomIn,
          o: map.zoomOut,
        },
      };

      const action = actions[prefix]?.[secondKey];
      if (action == null) {
        setPrefix(null);
        return;
      }
      e.stopPropagation();
      action();
      setPrefix(null);
    },
    { enabled: prefix != null, preventDefault: true }
  );
}
