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

const AREAS = [
  {
    desc: "Vulnerability detection, sensitive data leaks, and OWASP compliance check.",
    icon: ShieldCheck,
    id: PRFocusArea.SECURITY,
    label: "Security",
  },
  {
    desc: "Identifying computational bottlenecks, memory leaks, and N+1 query patterns.",
    icon: Zap,
    id: PRFocusArea.PERFORMANCE,
    label: "Performance",
  },
  {
    desc: "Patterns validation, modularity, and adherence to SOLID/DRY principles.",
    icon: Layout,
    id: PRFocusArea.ARCHITECTURE,
    label: "Architecture",
  },
  {
    desc: "Code cleanliness, naming consistency, and long-term maintainability.",
    icon: Palette,
    id: PRFocusArea.STYLE,
    label: "Style",
  },
] as const;

export function PRAnalysisConfigCard({ repoId }: Readonly<Props>) {
  const utils = trpc.useUtils();

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
            <CardTitle>AI Pull Request Analysis</CardTitle>
            <CardDescription>Configure how AI reviews your code changes</CardDescription>
          </div>
          <Switch
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
        <div className={isEnabled === true ? "opacity-100" : "pointer-events-none opacity-50"}>
          <div className="mb-6 flex flex-col gap-2">
            <Label htmlFor={commentStyleId}>Comment Style</Label>
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
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PRCommentStyle.DETAILED}>Detailed (In-depth review)</SelectItem>
                <SelectItem value={PRCommentStyle.CONCISE}>Concise (Short summaries)</SelectItem>
                <SelectItem value={PRCommentStyle.OFF}>Off (No comments)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mb-6 flex flex-col gap-3">
            <Label htmlFor={focusAreasId}>Focus Areas</Label>
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
                          ? currentFocusAreas.filter((id) => id !== area.id)
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
                    <div>
                      <p className="font-bold text-sm">{area.label}</p>
                      <p className="mt-1 text-muted-foreground text-xs">{area.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mb-8 flex flex-col gap-4">
            <div className="flex justify-between text-sm">
              <Label htmlFor={tokenBudgetId}>Token Budget</Label>
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
              value={[tokenBudget ?? 30_000]}
            />
            <p className="text-muted-foreground text-xs">
              Higher budget allows analyzing larger pull requests but costs more.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label
                className="text-sm"
                htmlFor={ciTriggersId}
              >
                Skip CI Triggers
              </Label>
              <p className="text-muted-foreground text-xs">
                Add [skip ci] to bot commits to save actions minutes.
              </p>
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
            Save Configuration
          </LoadingButton>
        </div>
      </CardContent>
    </Card>
  );
}
