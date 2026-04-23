"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

import { Badge } from "../core/badge";
import { CodeWindow } from "./code-window";

type Props = {
  afterHtmlDark: string;
  afterHtmlLight: string;
  badCode: string;
  beforeHtmlDark: string;
  beforeHtmlLight: string;
  filename: string;
  goodCode: string;
};

function noop() {}

function subscribe() {
  return noop;
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function CodeComparison({
  afterHtmlDark,
  afterHtmlLight,
  badCode,
  beforeHtmlDark,
  beforeHtmlLight,
  filename,
  goodCode,
}: Readonly<Props>) {
  const { resolvedTheme } = useTheme();
  const isMounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const isDark = isMounted && resolvedTheme === "dark";

  const beforeHtml = isDark ? beforeHtmlDark : beforeHtmlLight;
  const afterHtml = isDark ? afterHtmlDark : afterHtmlLight;

  return (
    <div className="mx-auto w-full">
      <div className="group border-border relative w-full overflow-hidden rounded-xl border">
        <div className="relative grid gap-4 md:grid-cols-2 md:gap-0">
          <CodeWindow
            code={badCode}
            codeClassName="text-xs p-2"
            codeHtml={beforeHtml}
            title={filename}
          />
          <CodeWindow
            code={goodCode}
            codeClassName="text-xs p-2"
            codeHtml={afterHtml}
            title={filename}
          />
        </div>

        <Badge
          variant="outline"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 hidden size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-bold md:flex"
        >
          VS
        </Badge>
      </div>
    </div>
  );
}