import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { useRouter } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";

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
  const { data: session } = authClient.useSession();
  const router = useRouter();
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

      if (data.user.name != null) {
        await authClient.updateUser({
          name: data.user.name,
        });
      }

      utils.user.me.setData(undefined, (old) => {
        if (old == null) return old;
        return {
          ...old,
          user: { ...old.user, name: data.user.name },
        };
      });

      propsRef.current.onProfileUpdateSuccess?.({
        email: data.user.email ?? null,
        name: data.user.name ?? null,
      });

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
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/auth");
          },
        },
      });
    },
  });

  const removeAvatar = trpc.user.removeAvatar.useMutation({
    onError: (err) => {
      toast.error(err.message);
    },
    onSuccess: async () => {
      toast.success(t("settings_profile_remove_avatar_toast_success"));

      await authClient.updateUser({
        image: "",
      });

      utils.user.me.setData(undefined, (old) => {
        if (old == null) return old;
        return {
          ...old,
          user: { ...old.user, image: null },
        };
      });

      propsRef.current.onAvatarRemoveSuccess?.();
    },
  });

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

        const cleanName = file.name
          .toLowerCase()
          .replace(/\.[^./]+$/, "")
          .replaceAll(/\s+/g, "-")
          .replaceAll(/[^\d._a-z-]/g, "");

        const fileName = `${Date.now()}-${cleanName || "avatar"}.webp`;
        const finalFile = new File([compressedBlob], fileName, { type: "image/webp" });

        const blobResult = await upload(`avatars/${fileName}`, finalFile, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
        });

        await authClient.updateUser({
          image: blobResult.url,
        });

        utils.user.me.setData(undefined, (old) => {
          if (old == null) return old;
          return {
            ...old,
            user: { ...old.user, image: blobResult.url },
          };
        });

        propsRef.current.onAvatarUpdateSuccess?.(blobResult.url);

        return blobResult;
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
        const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase();

        const ERROR_PATTERNS = [
          ["maximumsizeinbytes", "settings_profile_file_too_large"],
          ["too large", "settings_profile_file_too_large"],
          ["allowedcontenttypes", "settings_profile_invalid_file_format"],
          ["unauthorized", "settings_profile_not_logged_in"],
        ] as const;

        for (const [pattern, translationKey] of ERROR_PATTERNS) {
          if (errorMessage.includes(pattern)) {
            return t(translationKey);
          }
        }

        return t("settings_profile_error_uploading_file");
      },
      success: () => t("settings_profile_update_avatar_toast_success"),
    });

    return uploadPromise.catch(() => {});
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
