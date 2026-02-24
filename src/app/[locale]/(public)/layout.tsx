import type { ReactNode } from "react";

import { DotPattern } from "@/shared/ui/visuals/dot-pattern";

import { AppFooter } from "@/widgets/app-footer";
import { PublicHeader, PublicHeaderWrapper } from "@/widgets/public-header";

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <PublicHeaderWrapper>
        <PublicHeader />
      </PublicHeaderWrapper>
      <DotPattern
        cr={1}
        cx={1}
        cy={1}
        height={20}
        width={20}
        className="stroke-primary/50 fixed inset-0 -z-1 h-full w-full mask-[radial-gradient(circle_at_center,white,transparent)]"
      />
      <main className="mx-auto flex w-full flex-1 flex-col">{children}</main>
      <div className="z-50 w-full shrink-0 border-t">
        <AppFooter />
      </div>
    </>
  );
}
