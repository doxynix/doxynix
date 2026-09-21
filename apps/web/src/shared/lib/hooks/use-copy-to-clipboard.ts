import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function useCopyToClipboard(timeout = 2000) {
  const t = useTranslations("Common");
  const [isCopied, setIsCopied] = useState(false);

  const copy = async (value: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const isClipboardAvailable = typeof navigator !== "undefined" && "clipboard" in navigator;

    if (!isClipboardAvailable) {
      toast.error(t("clipboard_unavailable"));
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error(t("copy_failed"));
      setIsCopied(false);
    }
  };

  return { copy, isCopied };
}
