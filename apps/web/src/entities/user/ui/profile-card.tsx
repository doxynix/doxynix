"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { CloudUpload, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { authClient, type User } from "@/shared/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useProfileActions } from "@/features/profile/model/use-profile-actions";
import { ProfileDetailsForm } from "@/features/profile/ui/profile-details-form";

type Props = {
  user: User;
};

export function ProfileCard({ user: initialUser }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const { data: session } = authClient.useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = session?.user ?? initialUser;

  const [avatarUrl, setAvatarUrl] = useState(currentUser.image ?? "");
  const [prevImage, setPrevImage] = useState(currentUser.image);

  if (currentUser.image !== prevImage) {
    setPrevImage(currentUser.image);
    setAvatarUrl(currentUser.image ?? "");
  }

  const { isUploading, removeAvatar, uploadAvatar } = useProfileActions({
    onAvatarRemoveSuccess: () => {
      setAvatarUrl("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onAvatarUpdateSuccess: (url) => {
      setAvatarUrl(url);
    },
  });

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
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
              alt={currentUser.name}
              className="size-24"
              fallbackClassName="text-2xl"
              fallbackText={currentUser.name}
              priority={true}
              sizeClassName="size-24"
              src={avatarUrl}
            />
            {avatarUrl && (
              <LoadingButton
                aria-label="Delete Avatar"
                className="absolute right-0 bottom-0 cursor-pointer"
                disabled={removeAvatar.isPending}
                isLoading={removeAvatar.isPending}
                loadingText=""
                onClick={() => removeAvatar.mutate()}
                size="icon"
                variant="destructive"
              >
                <Trash2 />
              </LoadingButton>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              accept=".jpg, .jpeg, .png, .webp"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => void handleImageSelect(e)}
              ref={fileInputRef}
              type="file"
            />

            <LoadingButton
              className="cursor-pointer"
              isLoading={isUploading}
              loadingText="Loading..."
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
            >
              <CloudUpload /> {t("settings_profile_upload_photo_button")}
            </LoadingButton>

            <p className="text-center text-muted-foreground text-xs">
              {t("settings_profile_avatar_requirements")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings_profile_personal_information_title")}</CardTitle>
          <CardDescription>{t("settings_profile_personal_information_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ProfileDetailsForm user={currentUser} />
        </CardContent>
      </Card>
    </div>
  );
}
