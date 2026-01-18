import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Как мы собираем, используем и защищаем ваши данные.",
};

const SECTION_TITLE = "mb-3 text-lg font-bold text-foreground flex items-center gap-2";
const LIST_STYLES = "list-disc space-y-2 pl-5 marker:text-foreground";
const STRONG_TEXT = "font-medium text-foreground";

export default function PrivacyPage() {
  return (
    <div className="animate-fade-in container mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center text-sm transition-colors"
      >
        <ArrowLeft size={16} className="mr-2" />
        На главную
      </Link>

      <header className="mb-10 border-b pb-6">
        <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">
          Политика конфиденциальности
        </h1>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>Действует с 26 января 2025</span>
        </div>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm md:text-base">
        <section>
          <h2 className={SECTION_TITLE}>1. Введение</h2>
          <p className="leading-relaxed">
            Добро пожаловать в Doxynix («мы», «наш» или «нас»). Мы уважаем вашу конфиденциальность и
            серьезно относимся к защите ваших личных данных. Этот документ объясняет, какие данные
            мы собираем и как их используем при работе с сервисом doxynix.space.
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>2. Какие данные мы собираем</h2>
          <ul className={LIST_STYLES}>
            <li>
              <span className={STRONG_TEXT}>Аккаунт:</span> Имя, Email и Аватар. Мы получаем эти
              данные автоматически при входе через GitHub, Google, Yandex или Magic Link.
            </li>
            <li>
              <span className={STRONG_TEXT}>Технические данные:</span> IP-адрес, тип устройства,
              данные браузера и файлы Cookie (используются исключительно для аутентификации и
              аналитики, без передачи третьим лицам в рекламных целях).
            </li>
            <li>
              <p>
                <span className={STRONG_TEXT}>Исходный код:</span> Мы получаем доступ к вашим
                репозиториям в режиме <u>Read-Only</u> (только чтение) и исключительно в момент
                генерации документации.
              </p>
            </li>
          </ul>
          <p>
            <span className="text-destructive font-medium">Важно:</span> Мы{" "}
            <strong>не сохраняем</strong> ваш код в нашей базе данных. Он обрабатывается в
            оперативной памяти и удаляется сразу после завершения анализа.{" "}
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>3. Как мы используем ваши данные</h2>
          <ul className={LIST_STYLES}>
            <li>Для генерации документации, диаграмм и метрик кода.</li>
            <li>Для авторизации и сохранения истории ваших отчетов.</li>
            <li>Для отправки важных уведомлений (например, об изменениях в API).</li>
          </ul>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>4. Сторонние сервисы (Субпроцессоры)</h2>
          <p className="mb-3">
            Для работы сервиса мы используем проверенных партнеров. Мы передаем им только те данные,
            которые необходимы для выполнения конкретных технических задач:
          </p>
          <div className="bg-muted/50 rounded-xl border p-4">
            <ul className="grid gap-3 sm:grid-cols-2">
              <li className="flex flex-col">
                <span className={STRONG_TEXT}>Vercel</span>
                <span className="text-sm">
                  Хостинг, Edge Network и аналитика производительности.
                </span>
              </li>

              <li className="flex flex-col">
                <span className={STRONG_TEXT}>Neon (PostgreSQL)</span>
                <span className="text-sm">Основное зашифрованное хранилище данных.</span>
              </li>

              <li className="flex flex-col">
                <span className={STRONG_TEXT}>Resend</span>
                <span className="text-sm">Отправка писем для входа</span>{" "}
              </li>

              <li className="flex flex-col">
                <span className={STRONG_TEXT}>OAuth Провайдеры</span>
                <span className="text-sm">GitHub, Google, Yandex</span>
              </li>

              <li className="flex flex-col">
                <span className={STRONG_TEXT}>Upstash / Redis</span>
                <span className="text-sm">Кэширование и управление очередями задач.</span>
              </li>
              <li className="flex flex-col">
                <span className={STRONG_TEXT}>Axiom</span>
                <span className="text-sm">
                  Логирование системных ошибок и диагностика (хранятся до 30 дней).
                </span>
              </li>
              <li className="flex flex-col">
                <span className={STRONG_TEXT}>UploadThing</span>
                <span className="text-sm">Хранение пользовательских файлов и аватаров.</span>
              </li>
              <li className="flex flex-col">
                <span className={STRONG_TEXT}>Pusher</span>
                <span className="text-sm">Обеспечение работы WebSockets (реальное время).</span>
              </li>
            </ul>
          </div>
          <p className="text-muted-foreground mt-4 text-sm italic">
            Все указанные провайдеры являются признанными лидерами индустрии и обеспечивают защиту
            данных в соответствии с международными стандартами (GDPR, SOC2), регламентируемую их
            условиями использования.
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>5. Ваши права</h2>
          <p>
            Вы имеете право в любой момент запросить удаление всех ваших данных. Для этого напишите
            нам на почту или воспользуйтесь кнопкой «Удалить аккаунт» в настройках профиля. Удаление
            происходит необратимо.
          </p>
        </section>

        <section className="border-t">
          <h2 className={SECTION_TITLE}>6. Контакты</h2>
          <p>Если у вас остались вопросы, напишите нам.</p>
          <div className="mt-4">
            <a
              href="mailto:support@doxynix.space?subject=Вопрос по Privacy Policy"
              className="hover:no-underline"
            >
              support@doxynix.space
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
