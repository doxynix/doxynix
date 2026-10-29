import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upload } from "@vercel/blob/client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { useRouter } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";
import { compressImage } from "@/shared/lib/image-compression";
import { trackClientEvent } from "@/shared/lib/posthog-client";

import { resolveAvatarUploadErrorKey, sanitizeAvatarBaseName } from "./avatar-utils";

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
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("Dashboard");

  const [isProcessing, setIsProcessing] = useState(false);

  const updateProfile = useMutation(
    trpc.user.updateUser.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: async (data) => {
        toast.success(t("settings_profile_update_profile_toast_success"));

        if (data.user.name != null) {
          await authClient.updateUser({
            name: data.user.name,
          });
        }

        queryClient.setQueryData(trpc.user.me.queryKey(), (old) => {
          if (old == null) {
            return old;
          }
          return {
            ...old,
            user: { ...old.user, name: data.user.name },
          };
        });

        props.onProfileUpdateSuccess?.({
          email: data.user.email ?? null,
          name: data.user.name ?? null,
        });

        trackClientEvent("profile_updated", {
          has_email_changed: (session?.user.email ?? null) !== (data.user.email ?? null),
          has_name_changed: (session?.user.name ?? null) !== (data.user.name ?? null),
          user_id: data.user.id,
        });
      },
    }),
  );

  const deleteProfile = useMutation(
    trpc.user.deleteAccount.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: async () => {
        toast.success(t("settings_danger_delete_account_toast_success"));
        trackClientEvent("account_deleted");
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/auth");
            },
          },
        });
      },
    }),
  );

  const removeAvatar = useMutation(
    trpc.user.removeAvatar.mutationOptions({
      onError: (err) => {
        toast.error(err.message);
      },
      onSuccess: async () => {
        toast.success(t("settings_profile_remove_avatar_toast_success"));

        await authClient.updateUser({
          image: null,
        });

        queryClient.setQueryData(trpc.user.me.queryKey(), (old) => {
          if (old == null) {
            return old;
          }
          return {
            ...old,
            user: { ...old.user, image: null },
          };
        });

        props.onAvatarRemoveSuccess?.();
      },
    }),
  );

  const uploadAvatar = async (files: File[]) => {
    const file = files[0];
    if (file == null) {
      return;
    }

    setIsProcessing(true);

    const localPreviewUrl = URL.createObjectURL(file);
    props.onAvatarUpdateSuccess?.(localPreviewUrl);

    const uploadAvatarBlob = async () => {
      const compressedBlob = await compressImage(file, {
        fileType: "image/webp",
        initialQuality: 0.8,
        maxSizeMB: 0.1,
        maxWidthOrHeight: 512,
      });

      const cleanName = sanitizeAvatarBaseName(file.name);

      const fileName = `${Date.now()}-${cleanName || "avatar"}.webp`;
      const finalFile = new File([compressedBlob], fileName, { type: "image/webp" });

      const blobResult = await upload(`avatars/${fileName}`, finalFile, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });

      await authClient.updateUser({
        image: blobResult.url,
      });

      queryClient.setQueryData(trpc.user.me.queryKey(), (old) => {
        if (old == null) {
          return old;
        }
        return {
          ...old,
          user: { ...old.user, image: blobResult.url },
        };
      });

      props.onAvatarUpdateSuccess?.(blobResult.url);

      return blobResult;
    };

    const uploadPromise = uploadAvatarBlob()
      .catch((error: unknown) => {
        props.onAvatarUpdateSuccess?.(session?.user.image ?? "");
        throw error;
      })
      .finally(() => {
        setIsProcessing(false);
        URL.revokeObjectURL(localPreviewUrl);
      });

    toast.promise(uploadPromise, {
      error: (error: unknown) => t(resolveAvatarUploadErrorKey(error)),
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
