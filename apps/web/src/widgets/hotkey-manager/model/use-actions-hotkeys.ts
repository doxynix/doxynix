import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { useCreateRepoActions } from "@/entities/repo/model/use-create-repo-dialog.store";

const PREFIXES = ["c"];

export type GlobalHotkeyCommand = "createRepo";

const COMMAND_BY_SECOND_KEY: Record<string, Record<string, GlobalHotkeyCommand>> = {
  c: { r: "createRepo" },
};

export function resolveGlobalHotkeyCommand(
  prefix: string,
  code: string,
): GlobalHotkeyCommand | null {
  const secondKey = code.startsWith("Key") ? code.slice(3).toLowerCase() : null;

  if (secondKey == null) {
    return null;
  }

  return COMMAND_BY_SECOND_KEY[prefix]?.[secondKey] ?? null;
}

export function useGlobalActionsHotkeys(onAction?: () => void) {
  const { setOpen } = useCreateRepoActions();
  const [prefix, setPrefix] = useState<null | string>(null);

  useEffect(() => {
    if (prefix == null) {
      return;
    }

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
    [prefix],
  );

  useHotkeys(
    "*",
    (e) => {
      if (prefix == null) {
        return;
      }

      const command = resolveGlobalHotkeyCommand(prefix, e.code);
      if (command == null) {
        setPrefix(null);
        return;
      }

      e.stopPropagation();
      onAction?.();
      setTimeout(() => setOpen(true), 10);

      setPrefix(null);
    },
    {
      enabled: prefix != null,
      enableOnFormTags: false,
      preventDefault: true,
    },
    [prefix],
  );
}
