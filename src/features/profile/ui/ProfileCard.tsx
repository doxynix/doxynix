"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { User } from "next-auth";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

import { UpdateProfileSchema } from "@/shared/api/schemas/user";
import { trpc } from "@/shared/api/trpc";
import { getInitials } from "@/shared/lib/getInititals";
import { useUploadThing } from "@/shared/lib/uploadthing";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { LoadingButton } from "@/shared/ui/LoadingButton";

type Props = {
  user: User;
};

type ProfileFormValues = z.infer<typeof UpdateProfileSchema>;

export function ProfileCard({ user }: Props) {
  const { update } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState(user.image ?? "");

  const updateAvatar = trpc.user.updateAvatar.useMutation({
    onSuccess: async () => {
      toast.success("Фото профиля обновлено");
      await update();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeAvatar = trpc.user.removeAvatar.useMutation({
    onSuccess: async () => {
      setAvatarUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Фото удалено");
      await update();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const { startUpload, isUploading } = useUploadThing("avatarUploader", {
    onClientUploadComplete: (res) => {
      const file = res[0];
      setAvatarUrl(file.ufsUrl);
      updateAvatar.mutate({ url: file.ufsUrl, key: file.key });
    },
    onUploadError: (error: Error) => {
      let message = "Произошла ошибка при загрузке";
      if (error.message.includes("FileSizeMismatch")) {
        message = "Файл слишком большой (макс. 4МБ)";
      } else if (error.message.includes("InvalidFileType")) {
        message = "Неверный формат файла (доступные: .png, .jpg, .gif)";
      } else if (error.message.includes("Unauthorized")) {
        message = "Вы не авторизованы";
      }
      toast.error(`${message}`);
    },
  });

  const updateProfile = trpc.user.updateUser.useMutation({
    onSuccess: async () => {
      toast.success("Данные обновлены");
      await update();
      form.reset({
        name: form.getValues("name"),
        email: form.getValues("email"),
      });
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  React.useEffect(() => {
    updateProfile.reset();
    updateAvatar.reset();
    removeAvatar.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await startUpload([file]);
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(UpdateProfileSchema),
    values: {
      name: user.name ?? "",
      email: user.email ?? "",
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate({ name: values.name, email: values.email });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Фото профиля</CardTitle>
          <CardDescription>
            Это изображение будет отображаться в вашей учетной записи.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="border-border h-24 w-24 border-2">
              <AvatarImage src={avatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="text-2xl">
                {getInitials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            {avatarUrl && !updateAvatar.isPending && (
              <LoadingButton
                size="icon"
                variant="destructive"
                className="absolute right-0 bottom-0 cursor-pointer"
                disabled={removeAvatar.isPending}
                onClick={() => removeAvatar.mutate()}
                isLoading={removeAvatar.isPending}
                loadingText=""
              >
                <Trash2 className="h-4 w-4" />
              </LoadingButton>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              accept=".jpg, .jpeg, .png, .gif"
              onChange={handleImageSelect}
              disabled={isUploading}
            />

            <LoadingButton
              className="cursor-pointer"
              variant="outline"
              loadingText="Загрузка фото..."
              isLoading={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Загрузить фото
            </LoadingButton>

            <p className="text-muted-foreground text-center text-xs">
              Макс. 4MB (.jpg, .png, .gif)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Личная информация</CardTitle>
          <CardDescription>Обновите свое имя или почту.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-muted-foreground">Отображаемое имя</FormLabel>
                    <FormControl>
                      <Input placeholder="Ваше имя" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} placeholder="Ваша почта" />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <LoadingButton
                  loadingText="Сохранение..."
                  isLoading={updateProfile.isPending}
                  disabled={
                    !form.formState.isDirty || !form.formState.isValid || updateProfile.isPending
                  }
                  className="cursor-pointer"
                >
                  Сохранить
                </LoadingButton>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
