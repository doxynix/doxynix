"use client";

import React, { type ReactNode, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type Props = {
  children: ReactNode;
};

// The dynamic import lives here rather than in the component: React Compiler cannot lower a
// dynamic import and bails out of the whole function that contains one.
async function startAxeScan() {
  const axe = await import("@axe-core/react");
  await axe.default(React, ReactDOM, 1000);
}

export function A11yProvider({ children }: Readonly<Props>) {
  const t = useTranslations("Common");
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState("");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (process.env.NODE_ENV === "development" && typeof globalThis.window !== "undefined") {
      void startAxeScan();
    }
  }, []);

  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setAnnouncement("");
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const title = document.title || t("page_changed");

    const announceId = window.setTimeout(() => {
      setAnnouncement(t("navigated_to", { title }));
    }, 50);

    return () => {
      window.clearTimeout(announceId);
    };
  }, [pathname, t]);

  return (
    <>
      {children}
      <output
        aria-atomic="true"
        aria-live="assertive"
        className="sr-only"
      >
        {announcement}
      </output>
    </>
  );
}
