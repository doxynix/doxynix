"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { CreateApiKeySchema } from "@/shared/api/schemas/api-key";
import { useApiKeyActions } from "@/shared/hooks/use-api-key-actions";
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

export function CreateApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const { create } = useApiKeyActions();

  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const form = useForm<z.infer<typeof CreateApiKeySchema>>({
    resolver: zodResolver(CreateApiKeySchema),
    defaultValues: { name: "", description: "" },
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
        className="sm:max-w-md"
        onPointerDownOutside={(e) => createdKey !== null && e.preventDefault()}
        onEscapeKeyDown={(e) => createdKey !== null && e.preventDefault()}
      >
        {createdKey === null ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <DialogHeader>
                <DialogTitle> {t("settings_api_keys_create_api_key")}</DialogTitle>
                <DialogDescription>{t("settings_api_keys_name")}</DialogDescription>
              </DialogHeader>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">{tCommon("name")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("settings_api_keys_name_placeholder")}
                        disabled={create.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-muted-foreground">
                      {t("settings_api_keys_label")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-25 resize-none text-sm sm:text-base"
                        disabled={create.isPending}
                        placeholder={t("settings_api_keys_desc_placeholder")}
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
                  disabled={!form.formState.isValid || create.isPending}
                  loadingText="Saving..."
                  isLoading={create.isPending}
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
                <Input readOnly value={createdKey} disabled={create.isPending} />
              </div>
              <CopyButton
                tooltipText={tCommon("copy")}
                value={createdKey}
                className="opacity-100"
              />
            </div>

            <DialogFooter>
              <Button className="w-full cursor-pointer" onClick={() => handleOpenChange(false)}>
                {tCommon("done")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
