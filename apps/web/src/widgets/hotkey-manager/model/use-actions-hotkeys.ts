import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { useCreateRepoActions } from "@/entities/repo/model/use-create-repo-dialog.store";

const PREFIXES = ["c"];

export type GlobalHotkeyCommand = "createRepo";

const COMMAND_BY_SECOND_KEY: Record<string, Record<string, GlobalHotkeyCommand>> = {
  c: { r: "createRepo" },
};

export type SequenceResult =
  | { action: "execute"; command: GlobalHotkeyCommand }
  | { action: "reset" }
  | { action: "ignore" };

export function processGlobalHotkeySequence(prefix: string | null, code: string): SequenceResult {
  if (prefix == null) {
    return { action: "ignore" };
  }

  const secondKey = code.startsWith("Key") ? code.slice(3).toLowerCase() : null;
  if (secondKey == null) {
    return { action: "reset" };
  }

  const command = COMMAND_BY_SECOND_KEY[prefix]?.[secondKey];
  if (command == null) {
    return { action: "reset" };
  }

  return { action: "execute", command };
}

export function useGlobalActionsHotkeys(onAction?: () => void) {
  const { setOpen } = useCreateRepoActions();
  const [prefix, setPrefix] = useState<null | string>(null);

  useEffect(() => {
    if (prefix == null) {
      return;
    }
    const timer = setTimeout(() => setPrefix(null), 1500);
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
      const result = processGlobalHotkeySequence(prefix, e.code);

      if (result.action === "reset") {
        setPrefix(null);
        return;
      }

      if (result.action === "execute") {
        e.stopPropagation();
        onAction?.();
        setTimeout(() => setOpen(true), 10);
        setPrefix(null);
      }
    },
    {
      enabled: prefix != null,
      enableOnFormTags: false,
      preventDefault: true,
    },
    [prefix],
  );
}
