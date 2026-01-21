"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CreateApiKeySchema } from "@/shared/api/schemas/api-key";
import { trpc } from "@/shared/api/trpc";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const form = useForm<z.infer<typeof CreateApiKeySchema>>({
    resolver: zodResolver(CreateApiKeySchema),
    defaultValues: { name: "", description: "" },
  });

  const createMutation = trpc.apikey.create.useMutation({
    onSuccess: async (data) => {
      setCreatedKey(data.key);
      toast.success("API Key created successfully");
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
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
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
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>Name your key</DialogDescription>
              </DialogHeader>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Prod Server"
                        disabled={createMutation.isPending}
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
                    <FormLabel className="text-muted-foreground">Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        disabled={createMutation.isPending}
                        placeholder="What is this key used for?..."
                        className="min-h-25 resize-none"
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
                  loadingText="Saving..."
                  isLoading={createMutation.isPending}
                >
                  Create
                </LoadingButton>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Save your API Key</DialogTitle>
              <DialogDescription>
                Please copy the key now. We won&apos;t be able to show it again.{" "}
              </DialogDescription>
            </DialogHeader>

            <Alert
              variant="destructive"
              className="border-destructive/10 bg-destructive/5 text-destructive"
            >
              <AlertTitle className="text-base font-bold">Warning</AlertTitle>
              <AlertDescription>
                This key is visible only once. If you lose it, you will have to create a new one.
              </AlertDescription>
            </Alert>

            <div className="flex items-center space-x-2">
              <div className="grid flex-1 gap-2">
                <Input readOnly value={createdKey} disabled={createMutation.isPending} />
              </div>
              <CopyButton tooltipText="Copy" value={createdKey} className="opacity-100" />
            </div>

            <DialogFooter>
              <Button className="w-full cursor-pointer" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
