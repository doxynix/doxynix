"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Layout, Loader2, Palette, ShieldCheck, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  UpdatePRConfigInput,
  type UpdatePRConfigInputValues,
} from "@/shared/api/schemas/pr-analysis.schema";
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

import { PRCommentStyleSchema, PRFocusAreaSchema } from "@/generated/zod";

type Props = {
  repoId: string;
};

const AREAS = [
  {
    desc: "Vulnerability detection, sensitive data leaks, and OWASP compliance check.",
    icon: ShieldCheck,
    id: PRFocusAreaSchema.enum.SECURITY,
    label: "Security",
  },
  {
    desc: "Identifying computational bottlenecks, memory leaks, and N+1 query patterns.",
    icon: Zap,
    id: PRFocusAreaSchema.enum.PERFORMANCE,
    label: "Performance",
  },
  {
    desc: "Patterns validation, modularity, and adherence to SOLID/DRY principles.",
    icon: Layout,
    id: PRFocusAreaSchema.enum.ARCHITECTURE,
    label: "Architecture",
  },
  {
    desc: "Code cleanliness, naming consistency, and long-term maintainability.",
    icon: Palette,
    id: PRFocusAreaSchema.enum.STYLE,
    label: "Style",
  },
] as const;

export function PRAnalysisConfigCard({ repoId }: Readonly<Props>) {
  const utils = trpc.useUtils();

  const { data: config, isLoading } = trpc.prAnalysis.getRepoConfig.useQuery({ repoId });

  const updateConfig = trpc.prAnalysis.configureRepository.useMutation({
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      void utils.prAnalysis.getRepoConfig.invalidate({ repoId });
    },
  });

  const form = useForm<UpdatePRConfigInputValues>({
    resetOptions: {
      keepDirtyValues: true,
    },
    resolver: zodResolver(UpdatePRConfigInput),
    values: config != null ? { ...config, repoId } : undefined,
  });

  const onSubmit = (values: UpdatePRConfigInputValues) => {
    updateConfig.mutate({ ...values, repoId });
  };

  if (isLoading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  const currentFocusAreas = form.watch("focusAreas") ?? [];
  const isUpdating = updateConfig.isPending;
  const isEnabled = form.watch("enabled");

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
            onCheckedChange={(checked) => {
              form.setValue("enabled", checked, { shouldDirty: true });
              void form.handleSubmit(onSubmit)();
            }}
            className="data-[state=checked]:bg-foreground"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className={isEnabled === true ? "opacity-100" : "pointer-events-none opacity-50"}>
          <div className="mb-6 space-y-2">
            <Label>Comment Style</Label>
            <Select
              value={form.watch("commentStyle")}
              onValueChange={(v) =>
                form.setValue("commentStyle", v as UpdatePRConfigInputValues["commentStyle"], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PRCommentStyleSchema.enum.DETAILED}>
                  Detailed (In-depth review)
                </SelectItem>
                <SelectItem value={PRCommentStyleSchema.enum.CONCISE}>
                  Concise (Short summaries)
                </SelectItem>
                <SelectItem value={PRCommentStyleSchema.enum.OFF}>Off (No comments)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mb-6 space-y-3">
            <Label>Focus Areas</Label>
            <div className="grid grid-cols-2 gap-4">
              {AREAS.map((area) => {
                const isSelected = currentFocusAreas.includes(area.id);

                return (
                  <label
                    key={area.id}
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition-all",
                      isSelected === true
                        ? "border-border-strong bg-surface-selected"
                        : "border-border bg-card"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isUpdating}
                      onChange={() => {
                        const next =
                          isSelected === true
                            ? currentFocusAreas.filter((id) => id !== area.id)
                            : [...currentFocusAreas, area.id];
                        form.setValue("focusAreas", next, { shouldDirty: true });
                      }}
                      className="sr-only"
                    />

                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-lg border",
                          isSelected === true
                            ? "bg-primary text-primary-foreground border-border-strong"
                            : "bg-surface-hover text-muted-foreground border-border"
                        )}
                      >
                        <area.icon />
                      </div>
                      <Checkbox
                        checked={isSelected}
                        tabIndex={-1}
                        aria-hidden="true"
                        className="pointer-events-none size-4 rounded-full"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{area.label}</p>
                      <p className="text-muted-foreground mt-1 text-xs">{area.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mb-8 space-y-4">
            <div className="flex justify-between text-sm">
              <Label>Token Budget</Label>
              <span className="text-muted-foreground font-mono">
                {form.watch("tokenBudget")?.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[form.watch("tokenBudget") ?? 30_000]}
              max={100_000}
              min={10_000}
              step={5000}
              onValueChange={([val]) => {
                if (val != null) {
                  form.setValue("tokenBudget", val, { shouldDirty: true });
                }
              }}
            />
            <p className="text-muted-foreground text-xs">
              Higher budget allows analyzing larger pull requests but costs more.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Skip CI Triggers</Label>
              <p className="text-muted-foreground text-xs">
                Add [skip ci] to bot commits to save actions minutes.
              </p>
            </div>
            <Switch
              checked={form.watch("ciSkip")}
              onCheckedChange={(val) => form.setValue("ciSkip", val, { shouldDirty: true })}
              className="data-[state=checked]:bg-foreground"
            />
          </div>
          <LoadingButton
            disabled={isUpdating || !form.formState.isDirty}
            isLoading={isUpdating}
            onClick={() => void form.handleSubmit(onSubmit)}
            className="mt-6"
          >
            Save Configuration
          </LoadingButton>
        </div>
      </CardContent>
    </Card>
  );
}
