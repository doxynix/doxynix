import { useEffect, useState } from "react";
import type { Route } from "next";
import { useHotkeys } from "react-hotkeys-hook";

import { useRouter } from "@/i18n/routing";

const SEQUENTIAL_ROUTES: Record<string, Record<string, string>> = {
  g: {
    d: "/dashboard/settings/danger-zone",
    h: "/support",
    k: "/dashboard/settings/api-keys",
    n: "/dashboard/notifications",
    o: "/dashboard",
    p: "/dashboard/settings/profile",
    r: "/dashboard/repo",
    s: "/dashboard/settings/profile",
  },
};

const PREFIX_KEYS = Object.keys(SEQUENTIAL_ROUTES);

export function useNavigationHotkeys(onAction?: () => void) {
  const router = useRouter();
  const [prefix, setPrefix] = useState<string | null>(null);

  useEffect(() => {
    if (prefix == null) return;

    const timer = setTimeout(() => {
      setPrefix(null);
    }, 1500);

    return () => clearTimeout(timer);
  }, [prefix]);

  useHotkeys(
    PREFIX_KEYS.join(","),
    (e, handler) => {
      e.preventDefault();
      const pressedKey = handler.hotkey;
      setPrefix(pressedKey);
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    "*",
    (e) => {
      if (prefix == null) return;

      const code = e.code;
      let secondKey: string | null = null;

      if (code.startsWith("Key")) {
        secondKey = code.slice(3).toLowerCase();
      }

      if (secondKey == null) {
        setPrefix(null);
        return;
      }

      const path = SEQUENTIAL_ROUTES[prefix]?.[secondKey];

      if (path) {
        e.preventDefault();
        onAction?.();
        router.push(path as Route);
      }

      setPrefix(null);
    },
    { enabled: prefix != null, enableOnFormTags: false }
  );
}
