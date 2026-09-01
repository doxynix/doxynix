import type { ReactNode } from "react";

import { DotPattern } from "@/shared/ui/visuals/dot-pattern";

import { AppFooter } from "@/widgets/app-footer/ui/app-footer";
import { PublicHeader } from "@/widgets/public-header/ui/public-header";
import { PublicHeaderWrapper } from "@/widgets/public-header/ui/public-header-wrapper";

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div
      className="dark relative flex min-h-dvh flex-col bg-background text-foreground"
      data-public-theme="marketing-dark"
    >
      <PublicHeaderWrapper>
        <PublicHeader />
      </PublicHeaderWrapper>
      <DotPattern
        className="mask-[radial-gradient(circle_at_center,white,transparent)] pointer-events-none fixed inset-0 h-full w-full stroke-border-strong/70"
        cr={1}
        cx={1}
        cy={1}
        height={20}
        width={20}
      />
      <main className="z-10 mx-auto flex w-full flex-1 flex-col" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <div className="z-50 w-full shrink-0 border-t">
        <AppFooter />
      </div>
    </div>
  );
}
