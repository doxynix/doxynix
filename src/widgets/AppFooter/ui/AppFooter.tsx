import Link from "next/link";

import { DateComp } from "@/shared/ui/DateComp";
import GitHubIcon from "@/shared/ui/github-icon";
import { TelegramIcon } from "@/shared/ui/telegram-icon";

import { SystemStatus } from "./SystemStatus";

export function AppFooter() {
  return (
    <footer className="bg-background flex items-center justify-center p-3">
      <div className="container grid grid-cols-1 flex-col items-center justify-between justify-items-center gap-4 lg:flex lg:flex-row">
        <div className="order-1 flex flex-wrap items-center justify-center gap-4 lg:order-0">
          <p className="text-muted-foreground order-1 text-center text-xs lg:order-0">
            &copy; <DateComp isYear={true} /> Doxynix. All rights reserved. Built by developers for
            developers.
          </p>
          <SystemStatus />
        </div>
        <div className="text-muted-foreground xs:flex-row flex flex-col flex-wrap items-center justify-center gap-2 text-sm not-md:justify-center md:gap-6">
          <Link
            href="/terms"
            className="hover:text-foreground text-center text-xs transition-colors"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="hover:text-foreground text-center text-xs transition-colors"
          >
            Privacy Policy
          </Link>

          <div className="border-border flex items-center gap-4 md:pl-6 xl:border-l">
            <a
              href="https://github.com/doxynix/doxynix"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <GitHubIcon className="hidden h-4 w-4 md:block" />
              <span className="text-xs md:hidden">Github</span>
              <span className="sr-only">GitHub</span>
            </a>
            <a
              href="https://t.me/Float_inf"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <TelegramIcon className="hidden h-4 w-4 md:block" />
              <span className="text-xs md:hidden">Telegram</span>
              <span className="sr-only">Telegram</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
