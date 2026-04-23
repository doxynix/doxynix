"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import ReactDOM from "react-dom";

type Props = {
  children: ReactNode;
};

export function A11yProvider({ children }: Readonly<Props>) {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState("");

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
    const title = document.title || "Page changed";

    const clearId = window.setTimeout(() => setAnnouncement(""), 0);

    const announceId = window.setTimeout(() => {
      setAnnouncement(`Navigated to ${title}`);
    }, 50);

    return () => {
      window.clearTimeout(clearId);
      window.clearTimeout(announceId);
    };
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
