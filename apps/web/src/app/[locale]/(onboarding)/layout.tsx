import type { ReactNode } from "react";

import { Logo } from "@/shared/ui/branding/doxynix-logo";
import { AnimatedThemeToggler } from "@/shared/ui/core/animated-theme-toggler";
import { DotPattern } from "@/shared/ui/visuals/dot-pattern";

export default function OnboardingLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground">
      <DotPattern
        className="mask-[radial-gradient(circle_at_center,white,transparent)] pointer-events-none fixed inset-0 h-full w-full stroke-border-strong/70"
        cr={1}
        cx={1}
        cy={1}
        height={20}
        width={20}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo
          className="w-24"
          isInteractive={false}
        />
        <AnimatedThemeToggler />
      </header>

      <main
        className="relative z-10 flex flex-1 flex-col"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
