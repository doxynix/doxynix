"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import QRCode from "react-qr-code";
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
} from "@/shared/ui/core/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/shared/ui/core/input-otp";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { ConnectionCard } from "@/entities/connection/ui/connection-card";

export function TwoFactorCard() {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const { data: sessionContext, refetch: refetchSession } = authClient.useSession();
  const user = sessionContext?.user;
  const queryClient = useQueryClient();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<null | string[]>(null);
  const [totpUri, setTotpUri] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleOpenSetup = async () => {
    setIsSetupOpen(true);
    setIsGenerating(true);
    try {
      const res = await authClient.twoFactor.enable({});
      if (res.error) {
        throw new Error(res.error.message);
      }

      setBackupCodes(res.data.backupCodes);

      const totpRes = await authClient.twoFactor.getTotpUri({});
      if (totpRes.error) {
        throw new Error(totpRes.error.message);
      }
      if (totpRes.data.totpURI) {
        setTotpUri(totpRes.data.totpURI);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings_2fa_setup_failed"));
      setIsSetupOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const enable2FA = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onError: (err) => {
      toast.error(err.message);
    },
    onSuccess: () => {
      toast.success(t("settings_2fa_activated_success"));
      void refetchSession();
      void queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
    },
  });

  const disable2FA = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.twoFactor.disable({});
      if (error) {
        throw new Error(error.message);
      }
    },
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success(t("settings_2fa_disabled_success"));
      void refetchSession();
    },
  });

  const handleDownloadBackupCodes = () => {
    if (!backupCodes) {
      return;
    }
    const text = backupCodes.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "doxynix-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyBackupCodes = () => {
    if (!backupCodes) {
      return;
    }
    void navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success(t("settings_2fa_backup_codes_copied"));
  };

  const isEnabled = user?.twoFactorEnabled === true;

  return (
    <>
      <ConnectionCard
        action={
          isEnabled ? (
            <LoadingButton
              isLoading={disable2FA.isPending}
              onClick={() => disable2FA.mutate()}
              size="sm"
              variant="destructive"
            >
              {tCommon("disconnect")}
            </LoadingButton>
          ) : (
            <AppButton
              onClick={() => void handleOpenSetup()}
              size="sm"
            >
              {tCommon("setup")}
            </AppButton>
          )
        }
        description={isEnabled ? t("settings_2fa_enabled_desc") : t("settings_2fa_disabled_desc")}
        icon={
          isEnabled ? (
            <ShieldCheck className="size-5 text-success" />
          ) : (
            <ShieldAlert className="size-5 text-muted-foreground" />
          )
        }
        status={isEnabled ? t("settings_auth_status_connected") : undefined}
        title={t("settings_2fa_title")}
      />

      <Dialog
        onOpenChange={(open) => {
          setIsSetupOpen(open);
          if (!open) {
            setBackupCodes(null);
            setVerificationCode("");
            setTotpUri("");
          }
        }}
        open={isSetupOpen}
      >
        <DialogContent
          className="sm:max-w-md"
          onEscapeKeyDown={(e) => backupCodes != null && e.preventDefault()}
          onPointerDownOutside={(e) => backupCodes != null && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t("settings_2fa_setup_dialog_title")}</DialogTitle>
            <DialogDescription>{t("settings_2fa_setup_dialog_desc")}</DialogDescription>
          </DialogHeader>

          {backupCodes && enable2FA.isSuccess ? (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-destructive text-xs">
                <ShieldAlert size={16} />
                <span>{t("settings_2fa_backup_codes_warning")}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-4 text-center font-mono text-sm">
                {backupCodes.map((code) => (
                  <div key={code}>{code}</div>
                ))}
              </div>
              <div className="flex gap-2">
                <AppButton
                  className="w-full gap-2"
                  onClick={handleCopyBackupCodes}
                  variant="outline"
                >
                  {tCommon("copy")}
                </AppButton>
                <AppButton
                  className="w-full gap-2"
                  onClick={handleDownloadBackupCodes}
                  variant="outline"
                >
                  {tCommon("download")}
                </AppButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 py-4">
              {isGenerating ? (
                <div className="flex size-48 items-center justify-center">
                  <RefreshCw className="animate-spin text-muted-foreground" />
                </div>
              ) : (
                totpUri && (
                  <div className="rounded-xl bg-white p-2">
                    <QRCode
                      size={180}
                      value={totpUri}
                    />
                  </div>
                )
              )}

              <div className="flex w-full flex-col gap-2">
                <p className="text-center text-muted-foreground text-xs">
                  {t("settings_2fa_enter_code_hint")}
                </p>
                <InputOTP
                  containerClassName="flex justify-center"
                  maxLength={6}
                  onChange={(value) => setVerificationCode(value.replaceAll(/\D/g, ""))}
                  value={verificationCode}
                >
                  <InputOTPGroup>
                    <InputOTPSlot
                      className="h-12 w-12 text-lg"
                      index={0}
                    />
                    <InputOTPSlot
                      className="h-12 w-12 text-lg"
                      index={1}
                    />
                    <InputOTPSlot
                      className="h-12 w-12 text-lg"
                      index={2}
                    />
                  </InputOTPGroup>

                  <InputOTPSeparator className="mx-1 text-muted-foreground" />

                  <InputOTPGroup>
                    <InputOTPSlot
                      className="h-12 w-12 text-lg"
                      index={3}
                    />
                    <InputOTPSlot
                      className="h-12 w-12 text-lg"
                      index={4}
                    />
                    <InputOTPSlot
                      className="h-12 w-12 text-lg"
                      index={5}
                    />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          )}

          <DialogFooter>
            {backupCodes && enable2FA.isSuccess ? (
              <AppButton
                className="w-full"
                onClick={() => setIsSetupOpen(false)}
              >
                {tCommon("done")}
              </AppButton>
            ) : (
              <LoadingButton
                className="w-full"
                disabled={verificationCode.length !== 6 || enable2FA.isPending || isGenerating}
                isLoading={enable2FA.isPending}
                loadingText={t("settings_2fa_activating")}
                onClick={() => enable2FA.mutate(verificationCode)}
              >
                {t("settings_2fa_verify_and_enable")}
              </LoadingButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
