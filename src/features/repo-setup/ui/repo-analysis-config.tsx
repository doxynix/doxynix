import type { ComponentType } from "react";
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

import type { DocType } from "@/shared/api/trpc";
import { LOCALES } from "@/shared/constants/locales";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/core/button";
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
import { Flag, FLAGS } from "@/shared/ui/kit/language-switcher";

import type { ActionsType, StateType } from "../model/user-repo-setup";

type DocOption = {
  desc: string;
  icon: ComponentType<{ className?: string }>;
  id: DocType;
  label: string;
};

const DOC_OPTIONS: DocOption[] = [
  { desc: "Project overview & setup", icon: BookOpen, id: "README", label: "README" },
  { desc: "Endpoints & schemas", icon: Code2, id: "API", label: "API Reference" },
  { desc: "Deep system logic", icon: GitGraph, id: "ARCHITECTURE", label: "Architecture" },
  { desc: "Guide for developers", icon: Users, id: "CONTRIBUTING", label: "Contributing" },
  { desc: "Release history", icon: HistoryIcon, id: "CHANGELOG", label: "Changelog" },
] as const;

type Props = {
  actions: ActionsType;
  disabled: boolean;
  state: StateType;
};

export function RepoAnalysisConfig({ actions, disabled, state }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const translationKeys = LOCALES.map(
    (l) => `settings_language_${l.toLowerCase().replace("-", "_")}` as const
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5" />
          Analysis Configuration
        </CardTitle>
        <CardDescription>
          Fine-tune how Doxynix should interpret and document your code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Label className="text-muted-foreground flex items-center gap-2 text-sm">
              <Languages className="h-4 w-4" />
              Output Language
            </Label>
            <Select value={state.analysisLocale} onValueChange={actions.setAnalysisLocale}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l, i) => (
                  <SelectItem key={l} value={l}>
                    <div className="flex items-center gap-3">
                      <Flag alt={l} src={FLAGS[l] || FLAGS.en} />
                      <span>{t(translationKeys[i])}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-muted-foreground flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            Documentation Types
          </Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DOC_OPTIONS.map((opt) => {
              const isSelected = state.selectedDocs.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition-all",
                    "hover:bg-muted/50 focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2",
                    isSelected ? "border-foreground bg-accent/50" : "border-border"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={disabled}
                    onChange={() => actions.toggleDocType(opt.id)}
                    className="sr-only"
                  />

                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg border",
                        !isSelected && "bg-muted text-muted-foreground"
                      )}
                    >
                      <opt.icon className="h-4 w-4" />
                    </div>
                    <Checkbox checked={isSelected} className="h-4 w-4 rounded-full" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{opt.label}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{opt.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-muted-foreground flex items-center gap-2 text-sm">
            <MessageSquareText className="h-4 w-4" />
            Custom Instructions (optional)
          </Label>
          <Textarea
            value={state.instructions}
            placeholder="e.g. 'Use technical tone', 'Highlight security risks', 'Add code examples'..."
            onChange={(e) => actions.setInstructions(e.target.value)}
            className="h-35 resize-none"
          />
        </div>

        <div className="flex justify-end">
          <Button
            disabled={disabled}
            onClick={actions.handleStartAnalysis}
            className="w-fit cursor-pointer gap-2"
          >
            <Play className="h-4 w-4" />
            Start Analysis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
