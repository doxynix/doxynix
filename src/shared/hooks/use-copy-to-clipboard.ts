import { useCallback, useState } from "react";
import { toast } from "sonner";

export function useCopyToClipboard(timeout = 2000) {
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback(
    async (value: string) => {
      if (typeof window === "undefined" || navigator.clipboard?.writeText === null) {
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), timeout);
      } catch (err) {
        console.error("Failed to copy:", err);
        toast.error("Copy failed");
        setIsCopied(false);
      }
    },
    [timeout]
  );

  return { isCopied, copy };
}
