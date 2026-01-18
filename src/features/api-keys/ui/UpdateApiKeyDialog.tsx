"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CreateApiKeySchema } from "@/shared/api/schemas/api-key";
import { trpc } from "@/shared/api/trpc";
import { AppTooltip } from "@/shared/ui/AppTooltip";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { LoadingButton } from "@/shared/ui/LoadingButton";
import { Textarea } from "@/shared/ui/textarea";

import { UiApiKey } from "@/entities/api-keys";

type Props = {
  apiKey: UiApiKey;
};

export function UpdateApiKeyDialog({ apiKey }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof CreateApiKeySchema>>({
    resolver: zodResolver(CreateApiKeySchema),
    defaultValues: {
      name: apiKey.name,
      description: apiKey.description ?? "",
    },
  });

  const updateMutation = trpc.apikey.update.useMutation({
    onSuccess: async () => {
      toast.success("API-ключ обновлен");
      setOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (values: z.infer<typeof CreateApiKeySchema>) => {
    updateMutation.mutate({
      id: apiKey.id,
      ...values,
    });
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
      <AppTooltip content="Редактировать">
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      </AppTooltip>

      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Редактирование ключа</DialogTitle>
              <DialogDescription>
                Измените название или описание для ключа{" "}
                <span className="text-foreground font-bold">{apiKey.prefix}...</span>
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Например: Prod Server" {...field} />
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
                  <FormLabel className="text-muted-foreground">Описание (опционально)</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-25 resize-none"
                      placeholder="Для чего используется этот ключ..."
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
                disabled={
                  !form.formState.isDirty || !form.formState.isValid || updateMutation.isPending
                }
                loadingText="Создание..."
                isLoading={updateMutation.isPending}
              >
                Обновить
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
