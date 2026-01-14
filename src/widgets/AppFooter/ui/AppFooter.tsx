import Link from "next/link";

import { DateComp } from "@/shared/ui/DateComp";
import GitHubIcon from "@/shared/ui/github-icon";
import { TelegramIcon } from "@/shared/ui/telegram-icon";

import { SystemStatus } from "./SystemStatus";

export function AppFooter() {
  return (
    <footer className="bg-background sticky bottom-0 flex items-center justify-center border-t py-3">
      <div className="container flex flex-col items-center justify-between gap-4 md:flex-row md:px-8">
        <div className="flex items-center gap-4">
          <p className="text-muted-foreground text-center text-xs">
            &copy; <DateComp isYear={true} /> Doxynix. Все права защищены. Создано для
            разработчиков.
          </p>
          <SystemStatus />
        </div>

        <div className="text-muted-foreground flex items-center gap-6 text-sm">
          <Link href="/terms" className="hover:text-foreground text-xs transition-colors">
            Пользовательское соглашение
          </Link>
          <Link href="/privacy" className="hover:text-foreground text-xs transition-colors">
            Политика конфиденциальности
          </Link>

          <div className="border-border ml-2 flex items-center gap-4 border-l pl-6">
            <a
              href="https://github.com/doxynix/doxynix"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <GitHubIcon className="h-4 w-4" />
              <span className="sr-only">GitHub</span>
            </a>
            <a
              href="https://t.me/Float_inf"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <TelegramIcon className="h-4 w-4" />
              <span className="sr-only">Telegram</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
