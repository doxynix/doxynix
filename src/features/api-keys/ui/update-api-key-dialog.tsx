"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { CreateApiKeySchema, type CreateApiKeyInput } from "@/shared/api/schemas/api-key";
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
import { Form } from "@/shared/ui/core/form";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

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
            aria-label="Update key"
            className="text-muted-foreground opacity-0 transition-opacity not-md:opacity-100 group-hover:opacity-100"
          >
            <Pencil className="size-4" />
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

            <ApiKeyFormFields control={form.control} isPending={update.isPending} />

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
