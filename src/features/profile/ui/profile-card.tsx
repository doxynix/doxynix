"use client";

import React, { useRef, useState } from "react";
import { CloudUpload, Trash2 } from "lucide-react";
import type { User } from "next-auth";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useProfileActions } from "../model/use-profile-actions";
import { ProfileDetailsForm } from "./profile-details-form";

type Props = {
  user: User;
};

export function ProfileCard({ user: initialUser }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = session?.user ?? initialUser;

  const [avatarUrl, setAvatarUrl] = useState(currentUser.image ?? "");

  React.useEffect(() => {
    setAvatarUrl(currentUser.image ?? "");
  }, [currentUser.image]);

  const { isUploading, removeAvatar, uploadAvatar } = useProfileActions({
    onAvatarRemoveSuccess: () => {
      setAvatarUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onAvatarUpdateSuccess: (url) => {
      setAvatarUrl(url);
    },
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAvatar([file]);
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
            <AppAvatar
              alt={currentUser.name ?? "User"}
              fallbackClassName="text-2xl"
              fallbackText={currentUser.name ?? currentUser.email ?? undefined}
              priority={true}
              src={avatarUrl}
              className="size-24"
            />
            {avatarUrl && (
              <LoadingButton
                disabled={removeAvatar.isPending}
                isLoading={removeAvatar.isPending}
                loadingText=""
                size="icon"
                variant="destructive"
                onClick={() => removeAvatar.mutate()}
                className="absolute right-0 bottom-0 cursor-pointer"
              >
                <Trash2 className="size-4" />
              </LoadingButton>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg, .jpeg, .png, .webp"
              disabled={isUploading}
              onChange={(e) => void handleImageSelect(e)}
              className="hidden"
            />

            <LoadingButton
              isLoading={isUploading}
              loadingText="Loading..."
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer"
            >
              <CloudUpload className="size-4" /> {t("settings_profile_upload_photo_button")}
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
          <ProfileDetailsForm user={currentUser} />
        </CardContent>
      </Card>
    </div>
  );
}
