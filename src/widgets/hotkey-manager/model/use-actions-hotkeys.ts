import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { useCreateRepoActions } from "@/entities/repo";

const PREFIXES = ["c"];

export function useGlobalActionsHotkeys(onAction?: () => void) {
  const { setOpen } = useCreateRepoActions();
  const [prefix, setPrefix] = useState<string | null>(null);

  useEffect(() => {
    if (prefix == null) return;

    const timer = setTimeout(() => {
      setPrefix(null);
    }, 1500);

    return () => clearTimeout(timer);
  }, [prefix]);

  useHotkeys(
    PREFIXES.join(","),
    (_, handler) => {
      setPrefix(handler.hotkey);
    },
    {
      enabled: prefix == null,
      enableOnFormTags: false,
      preventDefault: true,
    },
    [prefix]
  );

  useHotkeys(
    "*",
    (e) => {
      if (prefix == null) return;

      const code = e.code;
      let secondKey: string | null = null;

      if (code.startsWith("Key")) {
        secondKey = code.slice(3).toLowerCase();
      }

      if (secondKey == null) {
        setPrefix(null);
        return;
      }

      const actions: Record<string, Record<string, () => void>> = {
        c: {
          r: () => {
            setTimeout(() => setOpen(true), 10);
          },
        },
      };

      const action = actions[prefix]?.[secondKey];

      if (action == null) {
        setPrefix(null);
        return;
      }

      e.stopPropagation();
      onAction?.();
      action();

      setPrefix(null);
    },
    {
      enabled: prefix != null,
      enableOnFormTags: false,
      preventDefault: true,
    }
  );
}
