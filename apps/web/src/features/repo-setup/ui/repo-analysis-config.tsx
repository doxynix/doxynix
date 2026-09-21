import { type ComponentType, useId } from "react";
import type { DocType } from "@doxynix/shared";
import {
  BookOpen,
  Code2,
  FileText,
  GitGraph,
  HistoryIcon,
  Languages,
  MessageSquareText,
  Play,
  Settings,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { LOCALES } from "@/shared/config/locales";
import { cn } from "@/shared/lib/cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Checkbox } from "@/shared/ui/core/checkbox";
import { Label } from "@/shared/ui/core/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";
import { Textarea } from "@/shared/ui/core/textarea";
import { FLAGS, Flag } from "@/shared/ui/kit/language-switcher";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { ActionsType, StateType } from "@/entities/repo/model/use-repo-setup";

type DocOption = {
  desc: string;
  icon: ComponentType<{ className?: string }>;
  id: DocType;
  label: string;
};

type Props = {
  actions: ActionsType;
  disabled: boolean;
  state: StateType;
};

export function RepoAnalysisConfig({ actions, disabled, state }: Readonly<Props>) {
  const languageLabelId = useId();
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const translationKeys = LOCALES.map(
    (l) => `settings_language_${l.toLowerCase().replace("-", "_")}` as const,
  );

  const isSelectionEmpty = state.selectedFilesCount === 0 || state.selectedDocs.length === 0;

  const DOC_OPTIONS: readonly DocOption[] = [
    {
      desc: t("setup_doc_readme_desc"),
      icon: BookOpen,
      id: "README",
      label: t("setup_doc_readme_label"),
    },
    { desc: t("setup_doc_api_desc"), icon: Code2, id: "API", label: t("setup_doc_api_label") },
    {
      desc: t("setup_doc_architecture_desc"),
      icon: GitGraph,
      id: "ARCHITECTURE",
      label: t("setup_doc_architecture_label"),
    },
    {
      desc: t("setup_doc_contributing_desc"),
      icon: Users,
      id: "CONTRIBUTING",
      label: t("setup_doc_contributing_label"),
    },
    {
      desc: t("setup_doc_changelog_desc"),
      icon: HistoryIcon,
      id: "CHANGELOG",
      label: t("setup_doc_changelog_label"),
    },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="size-5" />
          {t("setup_analysis_title")}
        </CardTitle>
        <CardDescription>{t("setup_analysis_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 overflow-y-auto">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Label
              className="flex items-center gap-2 text-muted-foreground text-sm"
              id={languageLabelId}
            >
              <Languages />
              {t("setup_output_language")}
            </Label>
            <Select
              onValueChange={actions.setAnalysisLocale}
              value={state.analysisLocale}
            >
              <SelectTrigger
                aria-labelledby={languageLabelId}
                className="w-full md:w-64"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l, i) => {
                  const key = translationKeys[i];
                  if (key == null) {
                    return null;
                  }
                  return (
                    <SelectItem
                      key={l}
                      value={l}
                    >
                      <div className="flex items-center gap-3">
                        <Flag
                          alt={l}
                          src={FLAGS[l] || FLAGS.en}
                        />
                        <span>{t(key)}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText />
            {t("setup_doc_types_label")}
          </Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DOC_OPTIONS.map((opt) => {
              const isSelected = state.selectedDocs.includes(opt.id);
              return (
                <label
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition-standard",
                    isSelected
                      ? "border-border-strong bg-surface-selected"
                      : "border-border bg-card",
                  )}
                  key={opt.id}
                >
                  <input
                    checked={isSelected}
                    className="sr-only"
                    disabled={disabled}
                    onChange={() => actions.toggleDocType(opt.id)}
                    type="checkbox"
                  />

                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg border",
                        isSelected
                          ? "border-border-strong bg-primary text-primary-foreground"
                          : "border-border bg-surface-hover text-muted-foreground",
                      )}
                    >
                      <opt.icon />
                    </div>
                    <Checkbox
                      aria-hidden="true"
                      checked={isSelected}
                      className="pointer-events-none size-4 rounded-full"
                      disabled={disabled}
                      tabIndex={-1}
                    />
                  </div>
                  <p className="font-bold text-sm">{opt.label}</p>
                  <p className="mt-1 text-muted-foreground text-xs">{opt.desc}</p>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label className="flex items-center gap-2 text-muted-foreground text-sm">
            <MessageSquareText />
            {t("setup_custom_instructions_label")}
          </Label>
          <Textarea
            className="h-30 resize-none"
            onChange={(e) => actions.setInstructions(e.target.value)}
            placeholder={t("setup_custom_instructions_placeholder")}
            value={state.instructions}
          />
        </div>

        <div className="flex justify-end">
          <LoadingButton
            className="w-fit cursor-pointer gap-2"
            disabled={disabled || isSelectionEmpty}
            isLoading={disabled}
            loadingText={tCommon("processing")}
            onClick={actions.handleStartAnalysis}
          >
            <Play />
            {t("setup_start_analysis")}
          </LoadingButton>
        </div>
      </CardContent>
    </Card>
  );
}
