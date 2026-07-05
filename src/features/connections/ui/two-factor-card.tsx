"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
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
      if (res.error) throw new Error(res.error.message);

      setBackupCodes(res.data.backupCodes);

      const totpRes = await authClient.twoFactor.getTotpUri({});
      if (totpRes.error) throw new Error(totpRes.error.message);
      if (totpRes.data.totpURI) {
        setTotpUri(totpRes.data.totpURI);
      }
    } catch (error: any) {
      toast.error(error.message);
      setIsSetupOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const enable2FA = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) throw new Error(error.message);
      return data;
    },
    onError: (err) => {
      toast.error(err.message);
    },
    onSuccess: () => {
      toast.success("Two-Factor Authentication activated successfully!");
      void refetchSession();
      void queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
    },
  });

  const disable2FA = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.twoFactor.disable({});
      if (error) throw new Error(error.message);
    },
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success("Two-Factor Authentication disabled");
      void refetchSession();
    },
  });

  const handleDownloadBackupCodes = () => {
    if (!backupCodes) return;
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
    if (!backupCodes) return;
    void navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Backup codes copied to clipboard");
  };

  const isEnabled = user?.twoFactorEnabled === true;

  return (
    <>
      <ConnectionCard
        action={
          isEnabled ? (
            <LoadingButton
              isLoading={disable2FA.isPending}
              size="sm"
              variant="destructive"
              onClick={() => disable2FA.mutate()}
            >
              Disconnect
            </LoadingButton>
          ) : (
            <AppButton size="sm" onClick={() => void handleOpenSetup()}>
              Setup
            </AppButton>
          )
        }
        description={
          isEnabled
            ? "Connected to Authenticator App (Google Authenticator / Authy)"
            : "Protect your account by requiring an OTP code during login."
        }
        icon={
          isEnabled ? (
            <ShieldCheck className="text-success size-5" />
          ) : (
            <ShieldAlert className="text-muted-foreground size-5" />
          )
        }
        status={isEnabled ? "Connected" : undefined}
        title="Two-Factor Authentication (2FA)"
      />

      <Dialog
        open={isSetupOpen}
        onOpenChange={(open) => {
          setIsSetupOpen(open);
          if (!open) {
            setBackupCodes(null);
            setVerificationCode("");
            setTotpUri("");
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={(e) => backupCodes != null && e.preventDefault()}
          onPointerDownOutside={(e) => backupCodes != null && e.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app and enter the verification code.
            </DialogDescription>
          </DialogHeader>

          {backupCodes && enable2FA.isSuccess ? (
            <div className="flex flex-col gap-4 py-4">
              <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl p-3 text-xs">
                <ShieldAlert size={16} />
                <span>
                  Save these backup codes in a secure place. If you lose your device, this is the
                  only way to recover access.
                </span>
              </div>
              <div className="bg-muted grid grid-cols-2 gap-2 rounded-xl p-4 text-center font-mono text-sm">
                {backupCodes.map((code) => (
                  <div key={code}>{code}</div>
                ))}
              </div>
              <div className="flex gap-2">
                <AppButton
                  variant="outline"
                  onClick={handleCopyBackupCodes}
                  className="w-full gap-2"
                >
                  Copy
                </AppButton>
                <AppButton
                  variant="outline"
                  onClick={handleDownloadBackupCodes}
                  className="w-full gap-2"
                >
                  Download
                </AppButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 py-4">
              {isGenerating ? (
                <div className="flex size-48 items-center justify-center">
                  <RefreshCw className="text-muted-foreground animate-spin" />
                </div>
              ) : (
                totpUri && (
                  <div className="rounded-xl bg-white p-2">
                    <QRCode value={totpUri} size={180} />
                  </div>
                )
              )}

              <div className="flex w-full flex-col gap-2">
                <p className="text-muted-foreground text-center text-xs">
                  Enter the 6-digit verification code from your app:
                </p>
                <InputOTP
                  value={verificationCode}
                  maxLength={6}
                  // disabled={isTwoFactorVerifying}
                  onChange={(value) => setVerificationCode(value.replaceAll(/\D/g, ""))}
                  containerClassName="flex justify-center"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
                    <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
                    <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
                  </InputOTPGroup>

                  <InputOTPSeparator className="text-muted-foreground mx-1" />

                  <InputOTPGroup>
                    <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
                    <InputOTPSlot index={4} className="h-12 w-12 text-lg" />
                    <InputOTPSlot index={5} className="h-12 w-12 text-lg" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          )}

          <DialogFooter>
            {backupCodes && enable2FA.isSuccess ? (
              <AppButton onClick={() => setIsSetupOpen(false)} className="w-full">
                Done
              </AppButton>
            ) : (
              <LoadingButton
                disabled={verificationCode.length !== 6 || enable2FA.isPending || isGenerating}
                isLoading={enable2FA.isPending}
                loadingText="Activating..."
                onClick={() => enable2FA.mutate(verificationCode)}
                className="w-full"
              >
                Verify & Enable
              </LoadingButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
