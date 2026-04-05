"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import ReactDOM from "react-dom";

import { IS_DEV } from "@/shared/constants/env.client";

type Props = {
  children: ReactNode;
};

export function A11yProvider({ children }: Readonly<Props>) {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (IS_DEV && typeof globalThis.window !== "undefined") {
      void import("@axe-core/react").then((axe) => {
        void axe.default(React, ReactDOM, 1000);
      });
    }
  }, []);

  useEffect(() => {
    if (pathname) {
      const title = document.title || "Page changed";
      setAnnouncement("");

      const id = window.setTimeout(() => {
        setAnnouncement(`Navigated to ${title}`);
      }, 50);

      return () => window.clearTimeout(id);
    }
  }, [pathname]);

  return (
    <>
      {children}
      <output aria-atomic="true" aria-live="assertive" className="sr-only">
        {announcement}
      </output>
    </>
  );
}
