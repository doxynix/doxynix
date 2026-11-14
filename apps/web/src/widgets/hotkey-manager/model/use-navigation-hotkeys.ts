import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { commandMenuItems } from "@/shared/config/navigation";
import { useRouter } from "@/shared/i18n/navigation";

const SEQUENCE_PATTERN = /^\s*(\S+)\s+then\s+(\S+)\s*$/i;

function buildSequentialRoutes(): Record<string, Record<string, string>> {
  const routes: Record<string, Record<string, string>> = {};

  for (const item of commandMenuItems) {
    if (item.href == null || item.shortcut == null) {
      continue;
    }

    const match = SEQUENCE_PATTERN.exec(item.shortcut);
    if (match == null) {
      continue;
    }

    const [, prefix, secondKey] = match;
    if (prefix == null || secondKey == null) {
      continue;
    }

    const prefixRoutes = (routes[prefix.toLowerCase()] ??= {});
    prefixRoutes[secondKey.toLowerCase()] = item.href;
  }

  const gRoutes = (routes.g ??= {});
  gRoutes.o ??= "/dashboard";

  return routes;
}

const SEQUENTIAL_ROUTES = buildSequentialRoutes();

const PREFIX_KEYS = Object.keys(SEQUENTIAL_ROUTES);

export type SequenceResult =
  | { action: "execute"; path: string }
  | { action: "reset" }
  | { action: "ignore" };

export function resolveNavigationRoute(prefix: string, code: string): string | null {
  const secondKey = code.startsWith("Key") ? code.slice(3).toLowerCase() : null;

  if (secondKey == null) {
    return null;
  }

  return SEQUENTIAL_ROUTES[prefix]?.[secondKey] ?? null;
}

export function processNavigationSequence(prefix: string | null, code: string): SequenceResult {
  if (prefix == null) {
    return { action: "ignore" };
  }

  const path = resolveNavigationRoute(prefix, code);
  if (path == null) {
    return { action: "reset" };
  }

  return { action: "execute", path };
}

export function useNavigationHotkeys(onAction?: () => void) {
  const router = useRouter();
  const [prefix, setPrefix] = useState<null | string>(null);

  useEffect(() => {
    if (prefix == null) {
      return;
    }

    const timer = setTimeout(() => {
      setPrefix(null);
    }, 1500);

    return () => clearTimeout(timer);
  }, [prefix]);

  useHotkeys(
    PREFIX_KEYS.join(","),
    (_, handler) => {
      const pressedKey = handler.hotkey;
      setPrefix(pressedKey);
    },
    { enableOnFormTags: false, preventDefault: true },
    [prefix],
  );

  useHotkeys(
    "*",
    (e) => {
      const result = processNavigationSequence(prefix, e.code);

      if (result.action === "reset") {
        setPrefix(null);
        return;
      }

      if (result.action === "execute") {
        onAction?.();
        router.push(result.path);
        setPrefix(null);
      }
    },
    { enabled: prefix != null, enableOnFormTags: false, preventDefault: true },
    [prefix],
  );
}
