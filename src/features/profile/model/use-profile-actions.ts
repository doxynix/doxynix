import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { useUploadThing } from "@/shared/lib/uploadthing";

type ProfileData = {
  email: string | null;
  name: string | null;
};

type UseProfileActionsProps = {
  onAvatarRemoveSuccess?: () => void;
  onAvatarUpdateSuccess?: (url: string) => void;
  onProfileUpdateSuccess?: (data: ProfileData) => void;
};

export function useProfileActions(props: UseProfileActionsProps = {}) {
  const { update: updateSession } = useSession();
  const utils = trpc.useUtils();
  const t = useTranslations("Dashboard");

  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  const updateProfile = trpc.user.updateUser.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: async (data) => {
      toast.success(t("settings_profile_update_profile_toast_success"));

      propsRef.current.onProfileUpdateSuccess?.({
        email: data.user.email ?? null,
        name: data.user.name ?? null,
      });

      await updateSession({
        email: data.user.email,
        name: data.user.name,
      });

      await utils.user.me.invalidate();
    },
  });

  const removeAvatar = trpc.user.removeAvatar.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: async () => {
      toast.success(t("settings_profile_remove_avatar_toast_success"));

      propsRef.current.onAvatarRemoveSuccess?.();

      await updateSession({ image: null });
      await utils.user.me.invalidate();
    },
  });

  const uploadThing = useUploadThing("avatarUploader", {
    onClientUploadComplete: async (res) => {
      const file = res[0];
      toast.success(t("settings_profile_update_avatar_toast_success"));

      propsRef.current.onAvatarUpdateSuccess?.(file.ufsUrl);

      await updateSession({ image: file.ufsUrl });
      await utils.user.me.invalidate();
    },
    onUploadError: (error) => {
      let message = t("settings_profile_error_uploading_file");
      if (error.message.includes("FileSizeMismatch")) {
        message = t("settings_profile_file_too_large");
      } else if (error.message.includes("InvalidFileType")) {
        message = t("settings_profile_invalid_file_format");
      } else if (error.message.includes(t("settings_profile_unauthorized"))) {
        message = t("settings_profile_not_logged_in");
      }
      toast.error(message);
    },
  });

  return {
    isPending: updateProfile.isPending || removeAvatar.isPending || uploadThing.isUploading,
    isUploading: uploadThing.isUploading,
    removeAvatar,
    updateProfile,
    uploadAvatar: uploadThing.startUpload,
  };
}
