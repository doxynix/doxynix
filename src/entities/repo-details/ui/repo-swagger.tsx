"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";

import "@scalar/api-reference-react/style.css";

export function RepoSwagger({ spec }: Readonly<{ spec: string }>) {
  const config = {
    content: spec,
    darkMode: true,
    isEditable: false,
    layout: "modern" as const,
    showSidebar: false,
    theme: "deepSpace" as const,
  };

  return (
    <div className="bg-background relative flex h-full min-h-0 w-full flex-col rounded-xl">
      <ApiReferenceReact configuration={config} />

      <style global jsx>{`
        .scalar-powered-by,
        a[href*="scalar.com"],
        .sidebar-footer,
        #scalar-header {
          display: none !important;
        }
        .light-mode,
        .dark-mode {
          background: transparent !important;
        }
        .section-container {
          padding: 0 !important;
        }

        // .scalar-app {
        //   height: 100% !important;
        //   display: flex !important;
        //   flex-direction: column !important;
        //   flex: 1 1 0% !important;
        //   min-height: 0 !important;
        // }
        // .references-classic, .references-modern {
        //   height: 100% !important;
        //   flex: 1 1 0% !important;
        //   overflow: hidden !important;
        // }
        // .references-rendered {
        //   height: 100% !important;
        //   overflow-y: auto !important;
        // }
      `}</style>
    </div>
  );
}
