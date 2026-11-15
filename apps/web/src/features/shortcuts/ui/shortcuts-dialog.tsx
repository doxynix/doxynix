"use client";

import { useTranslations } from "next-intl";

import { useShortcutLabels } from "@/shared/config/shortcut-labels";
import {
  formatShortcut,
  SHORTCUT_ENTRIES,
  SHORTCUT_GROUPS,
  type ShortcutGroup,
} from "@/shared/config/shortcuts";
import { useModifierKey } from "@/shared/lib/hooks/use-modifier-key";
import { useSingleKeyShortcuts } from "@/shared/lib/hooks/use-single-key-shortcuts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/core/dialog";
import { ShortcutHint } from "@/shared/ui/core/shortcut-hint";

import {
  useShortcutsDialogActions,
  useShortcutsDialogIsOpen,
} from "../model/use-shortcuts-dialog.store";

export function ShortcutsDialog() {
  const t = useTranslations("Shortcuts");
  const labels = useShortcutLabels();
  const modifierKey = useModifierKey();
  const singleKeyShortcuts = useSingleKeyShortcuts();
  const open = useShortcutsDialogIsOpen();
  const { setOpen } = useShortcutsDialogActions();

  const groupLabels: Record<ShortcutGroup, string> = {
    actions: t("group_actions"),
    interface: t("group_interface"),
    navigation: t("group_navigation"),
    repoMap: t("group_repo_map"),
  };

  return (
    <Dialog
      onOpenChange={setOpen}
      open={open}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
          {!singleKeyShortcuts && (
            <p className="text-muted-foreground text-xs">{t("sequences_disabled")}</p>
          )}
        </DialogHeader>

        <div className="sm:columns-2 sm:gap-8">
          {SHORTCUT_GROUPS.map((group) => {
            const entries = SHORTCUT_ENTRIES.filter((entry) => entry.group === group);
            if (entries.length === 0) {
              return null;
            }

            return (
              <section
                aria-labelledby={`shortcuts-${group}`}
                className="mb-6 break-inside-avoid"
                key={group}
              >
                <h3
                  className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                  id={`shortcuts-${group}`}
                >
                  {groupLabels[group]}
                </h3>
                {group === "repoMap" && (
                  <p className="mb-2 text-muted-foreground text-xs">{t("group_repo_map_hint")}</p>
                )}
                <dl className="flex flex-col gap-1">
                  {entries.map((entry) => (
                    <div
                      className="flex items-center justify-between gap-4"
                      key={entry.id}
                    >
                      <dt className="text-sm">{labels[entry.id]}</dt>
                      <dd>
                        <ShortcutHint
                          className="ml-0"
                          shortcut={entry.display ?? formatShortcut(entry.keys, modifierKey)}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>

        <DialogFooter className="flex-col items-start gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">{t("note")}</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
