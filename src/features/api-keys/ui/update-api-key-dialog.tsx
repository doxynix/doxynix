"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { CreateApiKeySchema } from "@/shared/api/schemas/api-key";
import type { UiApiKey } from "@/shared/api/trpc";
import { Button } from "@/shared/ui/core/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/core/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/core/form";
import { Input } from "@/shared/ui/core/input";
import { Textarea } from "@/shared/ui/core/textarea";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useApiKeyActions } from "../model/use-api-key-actions";

type Props = {
  apiKey: UiApiKey;
};

export function UpdateApiKeyDialog({ apiKey }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const { update } = useApiKeyActions();

  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const form = useForm<z.infer<typeof CreateApiKeySchema>>({
    defaultValues: {
      description: apiKey.description ?? "",
      name: apiKey.name,
    },
    resolver: zodResolver(CreateApiKeySchema),
  });

  const onSubmit = (values: z.infer<typeof CreateApiKeySchema>) => {
    update.mutate(
      { id: apiKey.id, ...values },
      {
        onSuccess: () => setOpen(false),
      }
    );
  };

  const handleOpenChange = (value: boolean) => {
    if (value) {
      form.reset({
        description: apiKey.description ?? "",
        name: apiKey.name,
      });
    }
    setOpen(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <AppTooltip content={tCommon("edit")}>
        <DialogTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground opacity-0 transition-opacity not-md:opacity-100 group-hover:opacity-100"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      </AppTooltip>

      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("settings_api_keys_edit_title")}</DialogTitle>
              <DialogDescription>
                {t("settings_api_keys_update_key_desc")}{" "}
                <span className="text-foreground font-bold">{apiKey.prefix}...</span>
              </DialogDescription>
            </DialogHeader>

            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">{tCommon("name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("settings_api_keys_name_placeholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="description"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">
                    {t("settings_api_keys_label")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("settings_api_keys_desc_placeholder")}
                      className="min-h-25 resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <LoadingButton
                type="submit"
                disabled={!form.formState.isDirty || !form.formState.isValid || update.isPending}
                isLoading={update.isPending}
                loadingText="Saving..."
                className="cursor-pointer"
              >
                {tCommon("update")}
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
