"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { type CreateApiKeyInput, CreateApiKeySchema } from "@/shared/api/schemas/api-key";
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
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { UiApiKey } from "@/entities/api-keys/model/api-keys.types";

import { useApiKeyActions } from "../model/use-api-key-actions";
import { ApiKeyFormFields } from "./api-key-form-fields";

type Props = {
  apiKey: UiApiKey;
};

export function UpdateApiKeyDialog({ apiKey }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const { update } = useApiKeyActions();

  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const form = useForm<CreateApiKeyInput>({
    defaultValues: {
      description: apiKey.description ?? "",
      name: apiKey.name,
    },
    resolver: zodResolver(CreateApiKeySchema),
  });

  const onSubmit = (values: CreateApiKeyInput) => {
    update.mutate(
      { id: apiKey.id, ...values },
      {
        onSuccess: () => setOpen(false),
      },
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
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <AppTooltip content={tCommon("edit")}>
        <DialogTrigger asChild>
          <AppButton
            aria-label="Update key"
            className="text-muted-foreground not-md:opacity-100 opacity-0 transition-opacity group-hover:opacity-100"
            size="icon"
            variant="ghost"
          >
            <Pencil />
          </AppButton>
        </DialogTrigger>
      </AppTooltip>

      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
          >
            <DialogHeader>
              <DialogTitle>{t("settings_api_keys_edit_title")}</DialogTitle>
              <DialogDescription>
                {t("settings_api_keys_update_key_desc")}{" "}
                <span className="font-bold text-foreground">{apiKey.prefix}...</span>
              </DialogDescription>
            </DialogHeader>

            <ApiKeyFormFields control={form.control} isPending={update.isPending} />

            <DialogFooter>
              <LoadingButton
                className="cursor-pointer"
                disabled={!form.formState.isDirty || !form.formState.isValid || update.isPending}
                isLoading={update.isPending}
                loadingText="Saving..."
                type="submit"
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
