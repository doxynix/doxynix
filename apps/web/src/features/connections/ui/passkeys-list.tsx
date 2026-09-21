"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Fingerprint, KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { authClient } from "@/shared/lib/auth-client";
import { AppButton } from "@/shared/ui/core/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/core/dialog";
import { Input } from "@/shared/ui/core/input";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { ConnectionCard } from "@/entities/connection/ui/connection-card";

export function PasskeysList() {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const [isSupported] = useState(
    () =>
      typeof window.PublicKeyCredential !== "undefined" &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
        "function",
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [deletingKeyId, setDeletingKeyId] = useState<null | string>(null);

  const {
    data: passkeys = [],
    isPending,
    refetch,
  } = useQuery({
    queryFn: async () => {
      const res = await authClient.passkey.listUserPasskeys();
      if (res.error) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    queryKey: ["passkeys"],
  });

  const createPasskey = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await authClient.passkey.addPasskey({ name });
      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onError: (err) => {
      toast.error(err.message);
    },
    onSuccess: () => {
      toast.success(t("settings_passkey_link_success"));
      setIsAddOpen(false);
      setDeviceName("");
      void refetch();
    },
  });

  const deletePasskey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient.passkey.deletePasskey({ id });
      if (error) {
        throw new Error(error.message);
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
    onSuccess: () => {
      toast.success(t("settings_passkey_remove_success"));
      setDeletingKeyId(null);
      void refetch();
    },
  });

  if (!isSupported) {
    return (
      <ConnectionCard
        action={
          <AppButton
            disabled
            size="sm"
          >
            {t("settings_passkey_not_supported")}
          </AppButton>
        }
        description={t("settings_passkey_not_supported_desc")}
        icon={<ShieldAlert className="text-muted-foreground" />}
        title={t("settings_passkey_webauthn_title")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog
          onOpenChange={setIsAddOpen}
          open={isAddOpen}
        >
          <DialogTrigger asChild>
            <AppButton
              className="gap-2"
              size="sm"
              variant="outline"
            >
              <Plus size={16} /> {t("settings_passkey_link_new_device")}
            </AppButton>
          </DialogTrigger>
          <DialogContent className="sm:max-w-105">
            <DialogHeader>
              <DialogTitle>{t("settings_passkey_link_dialog_title")}</DialogTitle>
              <DialogDescription>{t("settings_passkey_link_dialog_desc")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Input
                disabled={createPasskey.isPending}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder={t("settings_passkey_device_name_placeholder")}
                value={deviceName}
              />
            </div>
            <DialogFooter>
              <LoadingButton
                className="cursor-pointer"
                disabled={deviceName.trim().length === 0 || createPasskey.isPending}
                isLoading={createPasskey.isPending}
                loadingText={t("settings_passkey_verifying")}
                onClick={() => createPasskey.mutate(deviceName)}
              >
                {t("settings_passkey_register")}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isPending ? (
        <div className="py-4 text-center text-muted-foreground text-xs">
          {t("settings_passkey_loading")}
        </div>
      ) : passkeys.length === 0 ? (
        <ConnectionCard
          action={
            <AppButton
              onClick={() => setIsAddOpen(true)}
              size="sm"
            >
              {tCommon("setup")}
            </AppButton>
          }
          description={t("settings_passkey_empty_desc")}
          icon={<KeyRound className="size-5 text-muted-foreground" />}
          title={t("settings_passkey_empty_title")}
        />
      ) : (
        <div className="grid gap-3">
          {passkeys.map((key) => (
            <ConnectionCard
              action={
                <DangerActionDialog
                  confirmLabel={tCommon("remove")}
                  description={t("settings_passkey_delete_confirmation", { name: key.name ?? "" })}
                  destructiveAlertContent={<p>{t("settings_passkey_delete_alert")}</p>}
                  isLoading={deletePasskey.isPending}
                  onConfirm={() => deletePasskey.mutate(key.id)}
                  onOpenChange={(open) => setDeletingKeyId(open ? key.id : null)}
                  open={deletingKeyId === key.id}
                  title={t("settings_passkey_delete_title")}
                  trigger={
                    <AppButton
                      aria-label={t("settings_passkey_delete_aria")}
                      size="sm"
                      variant="destructive"
                    >
                      <Trash2 />
                    </AppButton>
                  }
                />
              }
              description={""}
              icon={<Fingerprint className="size-5 text-primary" />}
              key={key.id}
              status={tCommon("status_active")}
              title={key.name ?? t("settings_passkey_unnamed_device")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
