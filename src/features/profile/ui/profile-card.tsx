"use client";

import React, { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { User } from "next-auth";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import z from "zod";

import { UpdateProfileSchema } from "@/shared/api/schemas/user";
import { getInitials } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/core/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/core/form";
import { Input } from "@/shared/ui/core/input";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useProfileActions } from "../model/use-profile-actions";

type ProfileFormValues = z.infer<typeof UpdateProfileSchema>;

type Props = {
  user: User;
};

export function ProfileCard({ user }: Props) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayUser, setDisplayUser] = useState<User>(user);
  const [avatarUrl, setAvatarUrl] = useState(user?.image ?? "");

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: {
      name: displayUser.name ?? "",
      email: displayUser.email ?? "",
    },
  });

  const { isUploading, removeAvatar, updateAvatar, updateProfile, uploadAvatar } =
    useProfileActions({
      onProfileUpdateSuccess: (data) => {
        setDisplayUser((prev) => ({
          ...prev,
          name: data.name,
          email: data.email,
        }));

        form.reset({
          name: data.name ?? "",
          email: data.email ?? "",
        });
      },
      onAvatarUpdateSuccess: (url) => {
        setAvatarUrl(url);
      },
      onAvatarRemoveSuccess: () => {
        setAvatarUrl("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAvatar([file]);
  };

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate(values);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings_profile_picture_title")}</CardTitle>
          <CardDescription>{t("settings_profile_picture_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="border-border h-24 w-24 border-2">
              <AvatarImage src={avatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="text-2xl">
                {getInitials(displayUser.name, displayUser.email)}
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
              loadingText="Loading..."
              isLoading={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {t("settings_profile_upload_photo_button")}
            </LoadingButton>

            <p className="text-muted-foreground text-center text-xs">
              {t("settings_profile_avatar_requirements")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings_profile_personal_information_title")}</CardTitle>
          <CardDescription>{t("settings_profile_personal_information_desc")}</CardDescription>
          {/* <CardDescription>Update your name or email.</CardDescription> */}
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-muted-foreground">
                      {t("settings_profile_personal_information_label")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={updateProfile.isPending}
                        placeholder={t("settings_profile_personal_information_placeholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} className="text-sm sm:text-base" placeholder="Your email" />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              /> */}
              <div className="flex justify-end">
                <LoadingButton
                  loadingText="Saving..."
                  isLoading={updateProfile.isPending}
                  disabled={
                    !form.formState.isDirty || !form.formState.isValid || updateProfile.isPending
                  }
                  className="cursor-pointer"
                >
                  {tCommon("save")}
                </LoadingButton>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
