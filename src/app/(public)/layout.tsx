import { ReactNode } from "react";

import { DotPattern } from "@/shared/ui/visuals/dot-pattern";
import { AppFooter } from "@/widgets/app-footer";
import { PublicHeader } from "@/widgets/public-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-50 w-full shrink-0 border-b">
        <PublicHeader />
      </div>
      <DotPattern
        width={20}
        height={20}
        cx={1}
        cy={1}
        cr={1}
        className="stroke-primary/50 fixed inset-0 z-1 h-full w-full mask-[radial-gradient(circle_at_center,white,transparent)]"
      />
      <main className="mx-auto flex w-full flex-1 flex-col">{children}</main>
      <div className="z-50 w-full shrink-0 border-t">
        <AppFooter />
      </div>
    </div>
  );
}
