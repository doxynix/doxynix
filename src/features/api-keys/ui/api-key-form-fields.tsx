"use client";

import { useTranslations } from "next-intl";
import type { Control } from "react-hook-form";
import type { z } from "zod/v4-mini";

import type { CreateApiKeySchema } from "@/shared/api/schemas/api-key";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/core/form";
import { Input } from "@/shared/ui/core/input";
import { Textarea } from "@/shared/ui/core/textarea";

type FormValues = z.infer<typeof CreateApiKeySchema>;

type Props = {
  control: Control<FormValues>;
  isPending: boolean;
};

export function ApiKeyFormFields({ control, isPending }: Readonly<Props>) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  return (
    <>
      <FormField
        name="name"
        control={control}
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
        name="description"
        control={control}
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel className="text-muted-foreground">{t("settings_api_keys_label")}</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                disabled={isPending}
                placeholder={t("settings_api_keys_desc_placeholder")}
                className="min-h-25 resize-none text-sm sm:text-base"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
