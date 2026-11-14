import { Fragment } from "react";

import { cn } from "@/shared/lib/cn";
import { Kbd, KbdGroup } from "@/shared/ui/core/kbd";

type ShortcutHintProps = {
  className?: string;
  "data-slot"?: string;
  shortcut: string;
};

const SEQUENCE_SEPARATOR = /\s+then\s+/i;

function parseShortcut(shortcut: string) {
  const trimmed = shortcut.trim();

  if (trimmed.length === 0) {
    return { keys: [] as string[], sequence: false };
  }

  const sequenceKeys = trimmed
    .split(SEQUENCE_SEPARATOR)
    .map((key) => key.trim())
    .filter(Boolean);

  if (sequenceKeys.length > 1) {
    return { keys: sequenceKeys, sequence: true };
  }

  return {
    keys: trimmed
      .split("+")
      .map((key) => key.trim())
      .filter(Boolean),
    sequence: false,
  };
}

export function ShortcutHint({ className, "data-slot": dataSlot, shortcut }: ShortcutHintProps) {
  const { keys, sequence } = parseShortcut(shortcut);

  if (keys.length === 0) {
    return null;
  }

  return (
    <KbdGroup
      className={cn("ml-auto", className)}
      data-slot={dataSlot ?? "shortcut-hint"}
    >
      {keys.map((key, index) => (
        <Fragment key={`${key}-${index}`}>
          {sequence && index > 0 ? (
            <span className="text-[10px] text-muted-foreground">then</span>
          ) : null}
          <Kbd>{key}</Kbd>
        </Fragment>
      ))}
    </KbdGroup>
  );
}
