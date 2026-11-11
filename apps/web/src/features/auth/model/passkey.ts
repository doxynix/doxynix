"use client";

import { type RefObject, useEffect, useRef, useSyncExternalStore } from "react";

import { useRouter } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";
import { trackClientEvent } from "@/shared/lib/posthog-client";

const noopSubscribe = () => () => undefined;
const getLastUsedLoginMethod = () => authClient.getLastUsedLoginMethod();
const getNoLastUsedLogin = () => null;

type PasskeyRouter = ReturnType<typeof useRouter>;

function armPasskey(router: PasskeyRouter, target: string, pendingRef: RefObject<boolean>): void {
  if (pendingRef.current) {
    return;
  }

  pendingRef.current = true;

  void authClient.signIn
    .passkey({ autoFill: true })
    .then(({ error }) => {
      if (error) {
        return;
      }
      trackClientEvent("sign_in_attempted", { provider: "passkey" });
      router.replace(target);
    })
    .catch(() => {
      // An autofill attempt that finds no credential (or is dismissed) is not an error.
    })
    .finally(() => {
      pendingRef.current = false;
    });
}

export function useLastUsedLoginMethod() {
  return useSyncExternalStore(noopSubscribe, getLastUsedLoginMethod, getNoLastUsedLogin);
}

export function usePasskeyAutofill(target: string) {
  const router = useRouter();
  const pendingRef = useRef(false);

  useEffect(() => {
    armPasskey(router, target, pendingRef);
  }, [router, target]);

  return { arm: () => armPasskey(router, target, pendingRef) };
}
