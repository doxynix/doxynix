"use client";

import { Lock, ShieldCheck, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function TrustNotes() {
  const t = useTranslations("Welcome");

  const notes = [
    { icon: ShieldCheck, text: t("trust_readonly") },
    { icon: Trash2, text: t("trust_ephemeral") },
    { icon: Lock, text: t("trust_no_training") },
  ] as const;

  return (
    <ul className="flex flex-col gap-2 text-muted-foreground text-sm">
      {notes.map((note) => (
        <li
          className="flex items-start gap-2"
          key={note.text}
        >
          <note.icon className="mt-0.5 size-4 shrink-0 text-success" />
          <span>{note.text}</span>
        </li>
      ))}
    </ul>
  );
}
