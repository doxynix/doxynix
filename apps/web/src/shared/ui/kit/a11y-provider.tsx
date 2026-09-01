"use client";

import React, { type ReactNode, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { usePathname } from "next/navigation";

type Props = {
  children: ReactNode;
};

export function A11yProvider({ children }: Readonly<Props>) {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState("");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (process.env.NODE_ENV === "development" && typeof globalThis.window !== "undefined") {
      void import("@axe-core/react").then((axe) => {
        void axe.default(React, ReactDOM, 1000);
      });
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

    const title = document.title || "Page changed";

    const announceId = window.setTimeout(() => {
      setAnnouncement(`Navigated to ${title}`);
    }, 50);

    return () => {
      window.clearTimeout(announceId);
    };
  }, []);

  return (
    <>
      {children}
      <output aria-atomic="true" aria-live="assertive" className="sr-only">
        {announcement}
      </output>
    </>
  );
}
