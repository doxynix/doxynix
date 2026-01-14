"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CreateApiKeySchema } from "@/shared/api/schemas/api-key";
import { trpc } from "@/shared/api/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
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

export function CreateApiKeyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<z.infer<typeof CreateApiKeySchema>>({
    resolver: zodResolver(CreateApiKeySchema),
    defaultValues: { name: "", description: "" },
  });

  const createMutation = trpc.apikey.create.useMutation({
    onSuccess: async (data) => {
      setCreatedKey(data.key);
      toast.success("API-ключ успешно создан");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (values: z.infer<typeof CreateApiKeySchema>) => {
    createMutation.mutate(values);
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);

    if (!value) {
      setTimeout(() => {
        setCreatedKey(null);
        form.reset();
        setCopied(false);
      }, 300);
    }
  };

  const copyToClipboard = async () => {
    if (createdKey !== null) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Создать новый ключ
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
                <DialogTitle>Создание API-ключа</DialogTitle>
                <DialogDescription>Задайте название для ключа.</DialogDescription>
              </DialogHeader>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Название</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Например: Prod Server"
                        disabled={createMutation.isPending}
                        {...field}
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
                    <FormLabel className="text-muted-foreground">Описание (опционально)</FormLabel>
                    <FormControl>
                      <Textarea
                        disabled={createMutation.isPending}
                        placeholder="Для чего используется этот ключ..."
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
                  className="cursor-pointer"
                  disabled={!form.formState.isValid || createMutation.isPending}
                  loadingText="Создание..."
                  isLoading={createMutation.isPending}
                >
                  Создать
                </LoadingButton>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Сохраните ваш API-ключ</DialogTitle>
              <DialogDescription>
                Пожалуйста, скопируйте ключ сейчас. Мы не сможем показать его снова.
              </DialogDescription>
            </DialogHeader>

            <Alert
              variant="destructive"
              className="border-destructive/10 bg-destructive/5 text-destructive"
            >
              <AlertTitle className="text-[16px] font-bold">Внимание</AlertTitle>
              <AlertDescription>
                Этот ключ виден только один раз. Если вы потеряете его, придется создавать новый.
              </AlertDescription>
            </Alert>

            <div className="flex items-center space-x-2">
              <div className="grid flex-1 gap-2">
                <Input readOnly value={createdKey} disabled={createMutation.isPending} />
              </div>
              <AppTooltip
                content={copied && "Скопировано!"}
                open={copied ? true : undefined}
                hidden={copied ? false : true}
              >
                <Button className="cursor-pointer" size="icon" onClick={copyToClipboard}>
                  {copied ? (
                    <Check className="text-success h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </AppTooltip>
            </div>

            <DialogFooter>
              <Button className="w-full cursor-pointer" onClick={() => handleOpenChange(false)}>
                Готово
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
