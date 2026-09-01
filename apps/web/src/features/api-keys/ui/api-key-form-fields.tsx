"use client";

import { useTranslations } from "next-intl";
import type { Control } from "react-hook-form";

import type { CreateApiKeyInput } from "@/shared/api/schemas/api-key";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/core/form";
import { Input } from "@/shared/ui/core/input";
import { Textarea } from "@/shared/ui/core/textarea";

type Props = {
  control: Control<CreateApiKeyInput>;
  isPending: boolean;
};

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
    </>
  );
}
