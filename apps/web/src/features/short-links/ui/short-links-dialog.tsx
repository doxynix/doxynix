"use client";

import { useTranslations } from "next-intl";

import { APP_URL } from "@/shared/config/env.client";
import { useNavLabels } from "@/shared/config/navigation-labels";
import { HELP_SHORT_LINKS } from "@/shared/config/short-links";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/core/dialog";

import {
  useShortLinksDialogActions,
  useShortLinksDialogIsOpen,
} from "../model/use-short-links-dialog.store";
import { ShortLinkRow } from "./short-link-row";

export function ShortLinksDialog() {
  const t = useTranslations("ShortLinks");
  const navLabels = useNavLabels();
  const open = useShortLinksDialogIsOpen();
  const { setOpen } = useShortLinksDialogActions();

  return (
    <Dialog
      onOpenChange={setOpen}
      open={open}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <ul className="grid gap-0.5 rounded-xl border p-1 sm:grid-cols-2">
          {HELP_SHORT_LINKS.map((link) => (
            <li key={link.path}>
              <ShortLinkRow
                label={navLabels[link.labelKey]}
                path={link.path}
                url={new URL(link.path, APP_URL).toString()}
              />
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-row items-center justify-between border-t pt-4">
          <span className="text-muted-foreground text-xs">{t("hint")}</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
