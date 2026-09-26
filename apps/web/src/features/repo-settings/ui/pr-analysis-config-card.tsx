"use client";
import { useId } from "react";
import {
  PRCommentStyle,
  PRFocusArea,
  UpdatePRConfigInput,
  type UpdatePRConfigInputValues,
} from "@doxynix/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Layout, Loader2, Palette, ShieldCheck, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
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
import { Slider } from "@/shared/ui/core/slider";
import { Switch } from "@/shared/ui/core/switch";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

type Props = {
  repoId: string;
};

type Area = {
  desc: string;
  icon: typeof ShieldCheck;
  id: PRFocusArea;
  label: string;
};

export function PRAnalysisConfigCard({ repoId }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const utils = trpc.useUtils();

  const AREAS: readonly Area[] = [
    {
      desc: t("settings_pr_focus_security_desc"),
      icon: ShieldCheck,
      id: PRFocusArea.SECURITY,
      label: t("settings_pr_focus_security_label"),
    },
    {
      desc: t("settings_pr_focus_performance_desc"),
      icon: Zap,
      id: PRFocusArea.PERFORMANCE,
      label: t("settings_pr_focus_performance_label"),
    },
    {
      desc: t("settings_pr_focus_architecture_desc"),
      icon: Layout,
      id: PRFocusArea.ARCHITECTURE,
      label: t("settings_pr_focus_architecture_label"),
    },
    {
      desc: t("settings_pr_focus_style_desc"),
      icon: Palette,
      id: PRFocusArea.STYLE,
      label: t("settings_pr_focus_style_label"),
    },
  ] as const;

  const { data: config, isLoading } = trpc.analysis.getRepoConfig.useQuery({ repoId });

  const updateConfig = trpc.analysis.configureRepository.useMutation({
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      void utils.analysis.getRepoConfig.invalidate({ repoId });
    },
  });

  const form = useForm<UpdatePRConfigInputValues>({
    resetOptions: {
      keepDirtyValues: true,
    },
    resolver: zodResolver(UpdatePRConfigInput),
    values: config != null ? { ...config, repoId } : undefined,
  });

  const currentFocusAreas = useWatch({ control: form.control, name: "focusAreas" }) ?? [];
  const isEnabled = useWatch({ control: form.control, name: "enabled" });
  const commentStyle = useWatch({ control: form.control, name: "commentStyle" });
  const tokenBudget = useWatch({ control: form.control, name: "tokenBudget" });
  const ciSkip = useWatch({ control: form.control, name: "ciSkip" });

  const id = useId();

  const commentStyleId = `${id}-comment-style`;
  const focusAreasId = `${id}-focus-areas`;
  const tokenBudgetId = `${id}-token-budget`;
  const ciTriggersId = `${id}-ci-triggers`;

  const onSubmit = (values: UpdatePRConfigInputValues) => {
    updateConfig.mutate({ ...values, repoId });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const isUpdating = updateConfig.isPending;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("settings_pr_card_title")}</CardTitle>
            <CardDescription>{t("settings_pr_card_desc")}</CardDescription>
          </div>
          <Switch
            aria-label={t("settings_pr_card_title")}
            checked={isEnabled}
            className="data-[state=checked]:bg-foreground"
            onCheckedChange={(checked) => {
              form.setValue("enabled", checked, { shouldDirty: true });
              updateConfig.mutate({ ...form.getValues(), enabled: checked, repoId });
            }}
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className={isEnabled === true ? "opacity-100" : "pointer-events-none opacity-75"}>
          <div className="mb-6 flex flex-col gap-2">
            <Label htmlFor={commentStyleId}>{t("settings_pr_comment_style_label")}</Label>
            <Select
              onValueChange={(v) =>
                form.setValue("commentStyle", v as UpdatePRConfigInputValues["commentStyle"], {
                  shouldDirty: true,
                })
              }
              value={commentStyle}
            >
              <SelectTrigger
                className="w-full"
                id={commentStyleId}
              >
                <SelectValue placeholder={t("settings_pr_comment_style_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PRCommentStyle.DETAILED}>
                  {t("settings_pr_style_detailed")}
                </SelectItem>
                <SelectItem value={PRCommentStyle.CONCISE}>
                  {t("settings_pr_style_concise")}
                </SelectItem>
                <SelectItem value={PRCommentStyle.OFF}>{t("settings_pr_style_off")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mb-6 flex flex-col gap-3">
            <Label htmlFor={focusAreasId}>{t("settings_pr_focus_areas_label")}</Label>
            <div className="grid grid-cols-2 gap-4">
              {AREAS.map((area) => {
                const isSelected = currentFocusAreas.includes(area.id);
                const areaId = `${focusAreasId}-${area.id.toLowerCase()}`;

                return (
                  <label
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition-standard",

                      isSelected
                        ? "border-border-strong bg-surface-selected"
                        : "border-border bg-card",
                    )}
                    htmlFor={areaId}
                    key={area.id}
                  >
                    <input
                      checked={isSelected}
                      className="sr-only"
                      disabled={isUpdating}
                      id={areaId}
                      onChange={() => {
                        const next = isSelected
                          ? currentFocusAreas.filter((curr) => curr !== area.id)
                          : [...currentFocusAreas, area.id];
                        form.setValue("focusAreas", next, { shouldDirty: true });
                      }}
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
                        <area.icon />
                      </div>
                      <Checkbox
                        aria-hidden="true"
                        checked={isSelected}
                        className="pointer-events-none size-4 rounded-full"
                        tabIndex={-1}
                      />
                    </div>
                    <p className="font-bold text-sm">{area.label}</p>
                    <p className="mt-1 text-muted-foreground text-xs">{area.desc}</p>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mb-8 flex flex-col gap-4">
            <div className="flex justify-between text-sm">
              <Label htmlFor={tokenBudgetId}>{t("settings_pr_token_budget_label")}</Label>
              <span className="font-mono text-muted-foreground">
                {tokenBudget?.toLocaleString()}
              </span>
            </div>
            <Slider
              id={tokenBudgetId}
              max={100_000}
              min={10_000}
              onValueChange={([val]) => {
                if (val != null) {
                  form.setValue("tokenBudget", val, { shouldDirty: true });
                }
              }}
              step={5000}
              thumbLabel={t("settings_pr_token_budget_label")}
              value={[tokenBudget ?? 30_000]}
            />
            <p className="text-muted-foreground text-xs">{t("settings_pr_token_budget_hint")}</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label
                className="text-sm"
                htmlFor={ciTriggersId}
              >
                {t("settings_pr_skip_ci_label")}
              </Label>
              <p className="text-muted-foreground text-xs">{t("settings_pr_skip_ci_hint")}</p>
            </div>
            <Switch
              checked={ciSkip}
              className="data-[state=checked]:bg-foreground"
              id={ciTriggersId}
              onCheckedChange={(value) => form.setValue("ciSkip", value, { shouldDirty: true })}
            />
          </div>
          <LoadingButton
            className="mt-6"
            disabled={isUpdating || !form.formState.isDirty}
            isLoading={isUpdating}
            onClick={() => void form.handleSubmit(onSubmit)()}
          >
            {t("settings_pr_save_config")}
          </LoadingButton>
        </div>
      </CardContent>
    </Card>
  );
}
