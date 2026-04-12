import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { useUploadThing } from "@/shared/lib/uploadthing";

type ProfileData = {
  email: null | string;
  name: null | string;
};

type UseProfileActionsProps = {
  onAvatarRemoveSuccess?: () => void;
  onAvatarUpdateSuccess?: (url: string) => void;
  onProfileUpdateSuccess?: (data: ProfileData) => void;
};

export function useProfileActions(props: UseProfileActionsProps = {}) {
  const { data: session, update: updateSession } = useSession();
  const utils = trpc.useUtils();
  const t = useTranslations("Dashboard");

  const [isProcessing, setIsProcessing] = useState(false);

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
      posthog.capture("profile_updated", {
        has_email_changed: (session?.user.email ?? null) !== (data.user.email ?? null),
        has_name_changed: (session?.user.name ?? null) !== (data.user.name ?? null),
        user_id: data.user.id,
      });
    },
  });

  const deleteProfile = trpc.user.deleteAccount.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: async () => {
      toast.success(t("settings_danger_delete_account_toast_success"));
      posthog.capture("account_deleted");
      await signOut({ callbackUrl: "/auth" });
    },
  });

  const removeAvatar = trpc.user.removeAvatar.useMutation({
    onError: (err) => {
      toast.error(err.message);
    },
    onSuccess: async () => {
      toast.success(t("settings_profile_remove_avatar_toast_success"));

      propsRef.current.onAvatarRemoveSuccess?.();

      await updateSession({ image: null });
      await utils.user.me.invalidate();
    },
  });

  const { startUpload } = useUploadThing("avatarUploader");

  const uploadAvatar = async (files: File[]) => {
    const file = files[0];
    if (file == null) return;

    setIsProcessing(true);

    const localPreviewUrl = URL.createObjectURL(file);
    propsRef.current.onAvatarUpdateSuccess?.(localPreviewUrl);

    const processUpload = async () => {
      try {
        const { default: imageCompression } = await import("browser-image-compression");

        const compressedBlob = await imageCompression(file, {
          fileType: "image/webp",
          initialQuality: 0.8,
          maxSizeMB: 0.1,
          maxWidthOrHeight: 512,
          useWebWorker: true,
        });

        const fileName = file.name.replace(/\.[^./]+$/, ".webp");
        const finalFile = new File([compressedBlob], fileName, { type: "image/webp" });

        const res = await startUpload([finalFile]);
        if (!res?.[0]) throw new Error("Upload failed");

        const uploadedFile = res[0];

        await updateSession({ image: uploadedFile.ufsUrl });
        await utils.user.me.invalidate();

        return uploadedFile;
      } catch (error) {
        propsRef.current.onAvatarUpdateSuccess?.(session?.user.image ?? "");
        throw error;
      } finally {
        setIsProcessing(false);
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
    const uploadPromise = processUpload();

    toast.promise(uploadPromise, {
      error: (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);

        let message = t("settings_profile_error_uploading_file");
        if (errorMessage.includes("FileSizeMismatch")) {
          message = t("settings_profile_file_too_large");
        } else if (errorMessage.includes("InvalidFileType")) {
          message = t("settings_profile_invalid_file_format");
        } else if (errorMessage.includes(t("settings_profile_unauthorized"))) {
          message = t("settings_profile_not_logged_in");
        }
        return message;
      },
      success: (data) => {
        propsRef.current.onAvatarUpdateSuccess?.(data.ufsUrl);
        return t("settings_profile_update_avatar_toast_success");
      },
    });

    return uploadPromise;
  };

  return {
    deleteProfile,
    isPending: updateProfile.isPending || removeAvatar.isPending || isProcessing,
    isUploading: isProcessing,
    removeAvatar,
    updateProfile,
    uploadAvatar,
  };
}
