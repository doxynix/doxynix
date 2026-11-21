"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { CloudUpload, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { authClient, type User } from "@/shared/lib/auth-client";
import { Card, CardContent, CardDescription, CardTitle } from "@/shared/ui/core/card";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useProfileActions } from "../../model/profile/use-profile-actions";
import { ProfileDetailsForm } from "./profile-details-form";

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
    <Card>
      <div className="flex flex-wrap items-center gap-4 px-6">
        <AppAvatar
          alt={currentUser.name}
          fallbackClassName="text-lg"
          fallbackText={currentUser.name}
          priority={true}
          sizeClassName="size-14"
          src={avatarUrl}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardTitle className="truncate text-base">{currentUser.name}</CardTitle>
          <CardDescription className="truncate text-sm">{currentUser.email}</CardDescription>
          <p className="text-muted-foreground text-xs">
            {t("settings_profile_avatar_requirements")}
          </p>
        </div>

        <input
          accept=".jpg, .jpeg, .png, .webp"
          className="hidden"
          disabled={isUploading}
          onChange={(e) => void handleImageSelect(e)}
          ref={fileInputRef}
          type="file"
        />

        <div className="flex shrink-0 items-center gap-2">
          <LoadingButton
            isLoading={isUploading}
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            variant="outline"
          >
            <CloudUpload /> {t("settings_profile_upload_photo_button")}
          </LoadingButton>

          {avatarUrl && (
            <LoadingButton
              aria-label={t("settings_profile_delete_avatar")}
              disabled={removeAvatar.isPending}
              isLoading={removeAvatar.isPending}
              onClick={() => removeAvatar.mutate()}
              size="icon-sm"
              variant="ghost"
            >
              <Trash2 />
            </LoadingButton>
          )}
        </div>
      </div>

      <CardContent className="border-t pt-6">
        <ProfileDetailsForm user={currentUser} />
      </CardContent>
    </Card>
  );
}
