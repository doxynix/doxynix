import type { ReactNode } from "react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Home, LayoutGrid } from "lucide-react";

import { docsSource } from "@/shared/lib/docs-source";
import { Logo } from "@/shared/ui/branding/doxynix-logo";

import { DocsChatLayout } from "./docs-chat-layout";

const baseOptions: BaseLayoutProps = {
  githubUrl: "https://github.com/doxynix/doxynix",
  links: [
    { icon: <Home />, text: "Product", url: "/" },
    { icon: <LayoutGrid />, text: "Dashboard", url: "/dashboard" },
  ],
  nav: {
    title: (
      <>
        <Logo
          className="h-6 w-20"
          isInteractive={false}
        />
        <span className="sr-only">Doxynix documentation</span>
      </>
    ),
    url: "/",
  },
};

export default function DocsRouteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <RootProvider
      theme={{
        attribute: "class",
        defaultTheme: "system",
        disableTransitionOnChange: true,
        enableSystem: true,
        storageKey: "doxynix-theme",
      }}
    >
      <DocsChatLayout
        baseOptions={baseOptions}
        tree={docsSource.getPageTree()}
      >
        {children}
      </DocsChatLayout>
    </RootProvider>
  );
}
