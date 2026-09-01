"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { type CreateApiKeyInput, CreateApiKeySchema } from "@/shared/api/schemas/api-key";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";
import { AppButton } from "@/shared/ui/core/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/core/dialog";
import { Form } from "@/shared/ui/core/form";
import { Input } from "@/shared/ui/core/input";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useApiKeyActions } from "../model/use-api-key-actions";
import { ApiKeyFormFields } from "./api-key-form-fields";

export function CreateApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<null | string>(null);
  const { create } = useApiKeyActions();

  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const form = useForm<CreateApiKeyInput>({
    defaultValues: { description: "", name: "" },
    resolver: zodResolver(CreateApiKeySchema),
  });

  const onSubmit = (values: CreateApiKeyInput) => {
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
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <AppButton className="cursor-pointer" variant="outline">
          <Plus />
          {t("settings_api_keys_create_api_key")}
        </AppButton>
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => createdKey != null && e.preventDefault()}
        onPointerDownOutside={(e) => createdKey != null && e.preventDefault()}
      >
        {createdKey == null ? (
          <Form {...form}>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
            >
              <DialogHeader>
                <DialogTitle> {t("settings_api_keys_create_api_key")}</DialogTitle>
                <DialogDescription>{t("settings_api_keys_name")}</DialogDescription>
              </DialogHeader>

              <ApiKeyFormFields control={form.control} isPending={create.isPending} />

              <DialogFooter>
                <LoadingButton
                  className="cursor-pointer"
                  disabled={!form.formState.isValid || create.isPending}
                  isLoading={create.isPending}
                  loadingText="Saving..."
                  type="submit"
                >
                  {tCommon("create")}
                </LoadingButton>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("settings_api_keys_save_api_key")}</DialogTitle>
              <DialogDescription>{t("settings_api_keys_save_api_key_desc")} </DialogDescription>
            </DialogHeader>

            <Alert
              className="border-destructive/10 bg-destructive/5 text-destructive"
              variant="destructive"
            >
              <AlertTitle className="font-bold text-base">{tCommon("warning")}</AlertTitle>
              <AlertDescription>{t("settings_api_keys_alert_desc")}</AlertDescription>
            </Alert>

            <div className="flex items-center gap-2">
              <div className="grid flex-1 gap-2">
                <Input disabled={create.isPending} readOnly value={createdKey} />
              </div>
              <CopyButton
                className="opacity-100"
                tooltipText={tCommon("copy")}
                value={createdKey}
              />
            </div>

            <DialogFooter>
              <AppButton className="w-full cursor-pointer" onClick={() => handleOpenChange(false)}>
                {tCommon("done")}
              </AppButton>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
