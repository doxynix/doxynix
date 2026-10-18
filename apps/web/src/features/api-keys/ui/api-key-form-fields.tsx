"use client";

import { useState } from "react";
import { ApiKeyScope, type CreateApiKeyInput } from "@doxynix/shared";
import { CalendarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Control, ControllerRenderProps } from "react-hook-form";

import { formatShortDate } from "@/shared/lib/date-utils";
import { AppButton } from "@/shared/ui/core/button";
import { Calendar } from "@/shared/ui/core/calendar";
import { Checkbox } from "@/shared/ui/core/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/core/form";
import { Input } from "@/shared/ui/core/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/core/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";
import { Textarea } from "@/shared/ui/core/textarea";

type Props = {
  control: Control<CreateApiKeyInput>;
  isPending: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const PRESETS: { days: number | null; key: string }[] = [
  { days: 30, key: "30" },
  { days: 90, key: "90" },
  { days: 180, key: "180" },
  { days: 365, key: "365" },
  { days: null, key: "never" },
];

export function defaultExpiry(): Date {
  return new Date(Date.now() + 90 * DAY_MS);
}

function presetKeyFor(value: Date | null | undefined): string {
  if (value == null) {
    return "never";
  }
  const days = Math.round((value.getTime() - Date.now()) / DAY_MS);
  const match = PRESETS.find((p) => p.days === days);
  return match ? match.key : "custom";
}

const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
const disabledBeforeToday = (date: Date) => date < startOfToday;

type ExpiryFieldProps = {
  field: ControllerRenderProps<CreateApiKeyInput, "expiresAt">;
  isPending: boolean;
};

function ExpiryField({ field, isPending }: Readonly<ExpiryFieldProps>) {
  const t = useTranslations("Dashboard");
  const [preferCustom, setPreferCustom] = useState(false);
  const [prevValue, setPrevValue] = useState(field.value);

  if (prevValue !== field.value) {
    setPrevValue(field.value);
    if (field.value == null) {
      setPreferCustom(false);
    }
  }

  const customMode = preferCustom || presetKeyFor(field.value) === "custom";
  const selectValue = customMode ? "custom" : presetKeyFor(field.value);

  const handlePresetChange = (value: string) => {
    if (value === "never") {
      field.onChange(null);
      setPreferCustom(false);
      return;
    }
    if (value === "custom") {
      setPreferCustom(true);
      if (field.value == null) {
        field.onChange(new Date(Date.now() + 30 * DAY_MS));
      }
      return;
    }
    const preset = PRESETS.find((p) => p.key === value);
    if (preset?.days != null) {
      field.onChange(new Date(Date.now() + preset.days * DAY_MS));
      setPreferCustom(false);
    }
  };

  return (
    <>
      <Select
        disabled={isPending}
        onValueChange={handlePresetChange}
        value={selectValue}
      >
        <FormControl>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {PRESETS.map((preset) => (
            <SelectItem
              key={preset.key}
              value={preset.key}
            >
              {preset.key === "never"
                ? t("settings_api_keys_never_expires")
                : // oxlint-disable-next-line react/purity -- display-only preview of preset expiry
                  `${preset.key}d (${formatShortDate(new Date(Date.now() + (preset.days as number) * DAY_MS))})`}
            </SelectItem>
          ))}
          <SelectItem value="custom">
            {t("settings_api_keys_custom")}
            {field.value != null ? ` · ${formatShortDate(field.value)}` : ""}
          </SelectItem>
        </SelectContent>
      </Select>
      {field.value == null && (
        <p className="text-muted-foreground text-xs">{t("settings_api_keys_never_warn")}</p>
      )}
      {customMode && (
        <Popover>
          <PopoverTrigger asChild>
            <FormControl>
              <AppButton
                className="w-full justify-start gap-2 font-normal"
                disabled={isPending}
                type="button"
                variant="outline"
              >
                <CalendarIcon className="size-4" />
                {field.value != null
                  ? formatShortDate(field.value)
                  : t("settings_api_keys_never_expires")}
              </AppButton>
            </FormControl>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto p-0"
          >
            <Calendar
              disabled={disabledBeforeToday}
              mode="single"
              onSelect={field.onChange}
              selected={field.value ?? undefined}
            />
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}

export function ApiKeyFormFields({ control, isPending }: Readonly<Props>) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  return (
    <>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">{tCommon("name")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled={isPending}
                placeholder={t("settings_api_keys_name_placeholder")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel className="text-muted-foreground">{t("settings_api_keys_label")}</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                className="min-h-25 resize-none text-sm sm:text-base"
                disabled={isPending}
                placeholder={t("settings_api_keys_desc_placeholder")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="scopes"
        render={({ field }) => {
          const selected = field.value;
          const toggle = (scope: ApiKeyScope, checked: boolean) => {
            if (scope === ApiKeyScope.FULL) {
              field.onChange(checked ? [ApiKeyScope.FULL] : []);
              return;
            }
            const withoutFull = selected.filter((s) => s !== ApiKeyScope.FULL);
            field.onChange(
              checked
                ? [...new Set([...withoutFull, scope])]
                : withoutFull.filter((s) => s !== scope),
            );
          };
          return (
            <FormItem className="flex flex-col gap-2">
              <FormLabel className="text-muted-foreground">
                {t("settings_api_keys_scopes")}
              </FormLabel>
              <div className="grid gap-1 grid-cols-2">
                {[ApiKeyScope.MCP, ApiKeyScope.CLI, ApiKeyScope.FULL].map((scope) => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    key={scope}
                  >
                    <Checkbox
                      checked={selected.includes(scope)}
                      disabled={isPending}
                      onCheckedChange={(checked) => toggle(scope, checked === true)}
                    />
                    <span>
                      {scope === ApiKeyScope.MCP
                        ? t("settings_api_keys_scope_mcp")
                        : scope === ApiKeyScope.CLI
                          ? t("settings_api_keys_scope_cli")
                          : t("settings_api_keys_scope_full")}
                    </span>
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <FormField
        control={control}
        name="expiresAt"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel className="text-muted-foreground">
              {t("settings_api_keys_expires")}
            </FormLabel>
            <ExpiryField
              field={field}
              isPending={isPending}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
