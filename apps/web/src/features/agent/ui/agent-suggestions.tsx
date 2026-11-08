"use client";

import { GitBranch, ListChecks, ShieldCheck, Sparkles, Telescope } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";

type Props = {
  hasRepo: boolean;
  onSelect: (prompt: string) => void;
};

export function AgentSuggestions({ hasRepo, onSelect }: Readonly<Props>) {
  const t = useTranslations("Agent");

  const suggestions = hasRepo
    ? [
        { icon: ShieldCheck, label: t("suggestion_audit") },
        { icon: GitBranch, label: t("suggestion_architecture") },
        { icon: Telescope, label: t("suggestion_security") },
        { icon: Sparkles, label: t("suggestion_capabilities") },
      ]
    : [
        { icon: ListChecks, label: t("suggestion_list_repos") },
        { icon: Sparkles, label: t("suggestion_capabilities") },
      ];

  return (
    <ul
      aria-label={t("suggestions_label")}
      className="pointer-events-auto flex max-w-md flex-wrap justify-center gap-2"
    >
      {suggestions.map((suggestion) => {
        const Icon = suggestion.icon;

        return (
          <li key={suggestion.label}>
            <AppButton
              className="text-xs"
              onClick={() => onSelect(suggestion.label)}
              size="sm"
              variant="outline"
            >
              <Icon />
              {suggestion.label}
            </AppButton>
          </li>
        );
      })}
    </ul>
  );
}
