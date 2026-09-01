"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Fingerprint, KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useLocale } from "next-intl";
import { toast } from "sonner";

import { authClient } from "@/shared/lib/auth-client";
import { formatFullDate } from "@/shared/lib/date-utils";
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
  const [isSupported] = useState(
    () =>
      typeof window.PublicKeyCredential !== "undefined" &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
        "function",
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [deletingKeyId, setDeletingKeyId] = useState<null | string>(null);
  const locale = useLocale();

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
      toast.success("Biometric key linked successfully");
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
      toast.success("Biometric key removed");
      setDeletingKeyId(null);
      void refetch();
    },
  });

  if (!isSupported) {
    return (
      <ConnectionCard
        action={
          <AppButton disabled size="sm">
            Not Supported
          </AppButton>
        }
        description="Your current browser or hardware does not support biometric authentication."
        icon={<ShieldAlert className="text-muted-foreground" />}
        title="WebAuthn / Passkey"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog onOpenChange={setIsAddOpen} open={isAddOpen}>
          <DialogTrigger asChild>
            <AppButton className="gap-2" size="sm" variant="outline">
              <Plus size={16} /> Link New Device
            </AppButton>
          </DialogTrigger>
          <DialogContent className="sm:max-w-105">
            <DialogHeader>
              <DialogTitle>Link Biometric Device</DialogTitle>
              <DialogDescription>
                Enter a friendly name for this device (e.g. &quot;My Work MacBook TouchID&quot;) to
                easily identify it later.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Input
                disabled={createPasskey.isPending}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Device Name"
                value={deviceName}
              />
            </div>
            <DialogFooter>
              <LoadingButton
                className="cursor-pointer"
                disabled={deviceName.trim().length === 0 || createPasskey.isPending}
                isLoading={createPasskey.isPending}
                loadingText="Verifying..."
                onClick={() => createPasskey.mutate(deviceName)}
              >
                Register
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isPending ? (
        <div className="py-4 text-center text-muted-foreground text-xs">
          Loading active biometric devices...
        </div>
      ) : passkeys.length === 0 ? (
        <ConnectionCard
          action={
            <AppButton onClick={() => setIsAddOpen(true)} size="sm">
              Setup
            </AppButton>
          }
          description="Register your first TouchID, FaceID or physical security key for password-free login."
          icon={<KeyRound className="size-5 text-muted-foreground" />}
          title="No Devices Linked"
        />
      ) : (
        <div className="grid gap-3">
          {passkeys.map((key) => {
            const _dateStr = formatFullDate(new Date(key.createdAt).toISOString(), locale);

            return (
              <ConnectionCard
                action={
                  <DangerActionDialog
                    confirmLabel="Remove"
                    description={`Are you sure you want to delete biometric key &quot;${key.name}&quot;?`}
                    destructiveAlertContent={
                      <p>
                        You will no longer be able to use this specific hardware device to log in.
                      </p>
                    }
                    isLoading={deletePasskey.isPending}
                    onConfirm={() => deletePasskey.mutate(key.id)}
                    onOpenChange={(open) => setDeletingKeyId(open ? key.id : null)}
                    open={deletingKeyId === key.id}
                    title="Remove Biometric Key"
                    trigger={
                      <AppButton aria-label="Remove Biometric Key" size="sm" variant="destructive">
                        <Trash2 className="size-4" />
                      </AppButton>
                    }
                  />
                }
                description={""}
                icon={<Fingerprint className="size-5 text-primary" />}
                key={key.id}
                status="Active"
                title={key.name ?? "Unnamed Device"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
