"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { CreateApiKeySchema } from "@/shared/api/schemas/api-key";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";
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
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useApiKeyActions } from "../model/use-api-key-actions";

export function CreateApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const { create } = useApiKeyActions();

  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const form = useForm<z.infer<typeof CreateApiKeySchema>>({
    defaultValues: { description: "", name: "" },
    resolver: zodResolver(CreateApiKeySchema),
  });

  const onSubmit = (values: z.infer<typeof CreateApiKeySchema>) => {
    create.mutate(values, {
      onSuccess: (data) => {
        setCreatedKey(data.key);
      },
    });
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);

    if (!value) {
      setTimeout(() => {
        setCreatedKey(null);
        form.reset();
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          {t("settings_api_keys_create_api_key")}
        </Button>
      </DialogTrigger>

      <DialogContent
        onEscapeKeyDown={(e) => createdKey != null && e.preventDefault()}
        onPointerDownOutside={(e) => createdKey != null && e.preventDefault()}
        className="sm:max-w-md"
      >
        {createdKey == null ? (
          <Form {...form}>
            <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
              <DialogHeader>
                <DialogTitle> {t("settings_api_keys_create_api_key")}</DialogTitle>
                <DialogDescription>{t("settings_api_keys_name")}</DialogDescription>
              </DialogHeader>

              <FormField
                name="name"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">{tCommon("name")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={create.isPending}
                        placeholder={t("settings_api_keys_name_placeholder")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="description"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-muted-foreground">
                      {t("settings_api_keys_label")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        disabled={create.isPending}
                        placeholder={t("settings_api_keys_desc_placeholder")}
                        className="min-h-25 resize-none text-sm sm:text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <LoadingButton
                  type="submit"
                  disabled={!form.formState.isValid || create.isPending}
                  isLoading={create.isPending}
                  loadingText="Saving..."
                  className="cursor-pointer"
                >
                  {tCommon("create")}
                </LoadingButton>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("settings_api_keys_save_api_key")}</DialogTitle>
              <DialogDescription>{t("settings_api_keys_save_api_key_desc")} </DialogDescription>
            </DialogHeader>

            <Alert
              variant="destructive"
              className="border-destructive/10 bg-destructive/5 text-destructive"
            >
              <AlertTitle className="text-base font-bold">{tCommon("warning")}</AlertTitle>
              <AlertDescription>{t("settings_api_keys_alert_desc")}</AlertDescription>
            </Alert>

            <div className="flex items-center space-x-2">
              <div className="grid flex-1 gap-2">
                <Input value={createdKey} readOnly disabled={create.isPending} />
              </div>
              <CopyButton
                value={createdKey}
                tooltipText={tCommon("copy")}
                className="opacity-100"
              />
            </div>

            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)} className="w-full cursor-pointer">
                {tCommon("done")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
