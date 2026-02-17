"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { CreateApiKeySchema } from "@/shared/api/schemas/api-key";
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

import { UiApiKey } from "@/entities/api-keys";
import { useApiKeyActions } from "../model/use-api-key-actions";

type Props = {
  apiKey: UiApiKey;
};

export function UpdateApiKeyDialog({ apiKey }: Props) {
  const [open, setOpen] = useState(false);
  const { update } = useApiKeyActions();

  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const form = useForm<z.infer<typeof CreateApiKeySchema>>({
    resolver: zodResolver(CreateApiKeySchema),
    defaultValues: {
      name: apiKey.name,
      description: apiKey.description ?? "",
    },
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
        name: apiKey.name,
        description: apiKey.description ?? "",
      });
    }
    setOpen(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <AppTooltip content={tCommon("edit")}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground opacity-0 transition-opacity not-md:opacity-100 group-hover:opacity-100"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      </AppTooltip>

      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("settings_api_keys_edit_title")}</DialogTitle>
              <DialogDescription>
                {t("settings_api_keys_update_key_desc")}{" "}
                <span className="text-foreground font-bold">{apiKey.prefix}...</span>
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="name"
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
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">
                    {t("settings_api_keys_label")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-25 resize-none"
                      placeholder={t("settings_api_keys_desc_placeholder")}
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
                className="cursor-pointer"
                disabled={!form.formState.isDirty || !form.formState.isValid || update.isPending}
                loadingText="Saving..."
                isLoading={update.isPending}
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
