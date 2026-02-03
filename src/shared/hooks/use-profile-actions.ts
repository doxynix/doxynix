import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { useUploadThing } from "@/shared/lib/uploadthing";

type ProfileData = {
  name: string | null;
  email: string | null;
};

type UseProfileActionsProps = {
  onProfileUpdateSuccess?: (data: ProfileData) => void;
  onAvatarUpdateSuccess?: (url: string) => void;
  onAvatarRemoveSuccess?: () => void;
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
    onSuccess: async (data) => {
      toast.success(t("settings_profile_update_profile_toast_success"));

      if (data.user !== null) {
        propsRef.current.onProfileUpdateSuccess?.({
          name: data.user.name ?? null,
          email: data.user.email ?? null,
        });
      }

      await updateSession({
        name: data.user.name,
        email: data.user.email,
      });

      await utils.user.me.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateAvatar = trpc.user.updateAvatar.useMutation({
    onSuccess: async (data) => {
      toast.success(t("settings_profile_update_avatar_toast_success"));

      propsRef.current.onAvatarUpdateSuccess?.(data.image ?? "");

      await updateSession({ image: data.image });

      await utils.user.me.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeAvatar = trpc.user.removeAvatar.useMutation({
    onSuccess: async () => {
      toast.success(t("settings_profile_remove_avatar_toast_success"));

      propsRef.current.onAvatarRemoveSuccess?.();

      await updateSession({ image: null });
      await utils.user.me.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadThing = useUploadThing("avatarUploader", {
    onClientUploadComplete: (res) => {
      const file = res[0];
      updateAvatar.mutate({ url: file.ufsUrl, key: file.key });
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
    updateProfile,
    removeAvatar,
    updateAvatar,
    uploadAvatar: uploadThing.startUpload,
    isUploading: uploadThing.isUploading,
    isPending: updateProfile.isPending || updateAvatar.isPending || removeAvatar.isPending,
  };
}
