import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Пользовательское соглашение",
  description: "Правила использования сервиса Doxynix.",
};

const SECTION_TITLE = "mb-3 text-lg font-bold text-foreground flex items-center gap-2";
const LIST_STYLES = "list-disc space-y-2 pl-5 marker:text-foreground";
const STRONG_TEXT = "font-medium text-foreground";

export default function TermsPage() {
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
          Пользовательское соглашение
        </h1>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>Последнее обновление: 26 января 2025</span>
        </div>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm md:text-base">
        <section>
          <h2 className={SECTION_TITLE}>1. Принятие условий</h2>
          <p className="leading-relaxed">
            Добро пожаловать в Doxynix. Используя наш веб-сайт (doxynix.space) и наши инструменты
            аналитики, вы безоговорочно соглашаетесь с данными условиями. Сервис не предназначен для
            использования лицами младше 13 лет. Регистрируясь в Doxynix, вы подтверждаете, что вам
            исполнилось 13 лет или больше. Если вы не согласны с каким-либо пунктом, пожалуйста,
            прекратите использование сервиса.
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>2. Правила использования</h2>
          <p className="mb-3">
            Вы соглашаетесь использовать сервис только в законных целях. Запрещается:
          </p>
          <ul className={LIST_STYLES}>
            <li>
              Использовать сервис для анализа вредоносного ПО, вирусов или кода, нарушающего права
              третьих лиц.
            </li>
            <li>Пытаться нарушить работу сервиса (DDoS-атаки, инъекции, перегрузка API).</li>
            <li>Пытаться получить доступ к чужим аккаунтам или закрытым данным.</li>
            <li>Заниматься реверс-инжинирингом (обратной разработкой) алгоритмов Doxynix.</li>
          </ul>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>3. Интеллектуальная собственность</h2>
          <div className="bg-muted/50 rounded-xl border p-4">
            <p className="mb-2">
              <span className={STRONG_TEXT}>Ваши данные:</span> Мы не претендуем на права на ваш
              исходный код. Весь код, который вы анализируете через Doxynix, остается вашей
              собственностью.
            </p>
            <p>
              <span className={STRONG_TEXT}>Наш сервис:</span> Сам интерфейс Doxynix, логотипы,
              алгоритмы генерации документации и дизайн являются нашей интеллектуальной
              собственностью.
            </p>
          </div>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>4. Подписки и Оплата</h2>
          <p>
            Базовый функционал предоставляется бесплатно. Мы оставляем за собой право вводить
            платные тарифы (Premium) в будущем. Вы будете уведомлены об изменении тарификации
            заранее. Возврат средств за цифровые услуги не предусмотрен, если иное не требует
            законодательство.
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>5. Отказ от ответственности (AS IS)</h2>
          <p className="mb-2 italic">Это важный раздел. Пожалуйста, прочитайте его внимательно.</p>
          <div className="border-muted-foreground border-l-2 pl-4">
            <p>
              Сервис предоставляется по принципу <strong>«как есть» (as is)</strong>. Мы прилагаем
              все усилия для точности анализа, но не гарантируем, что сгенерированная документация
              будет полностью соответствовать вашему коду или что сервис будет работать без ошибок и
              перебоев.
            </p>
            <p>
              Мы не несем ответственности за любые прямые или косвенные убытки (включая потерю
              данных или прибыли), возникшие в результате использования Doxynix. Вы используете
              результаты анализа на свой страх и риск.
            </p>
          </div>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>6. Прекращение доступа</h2>
          <p>
            Мы имеем право заблокировать или удалить ваш аккаунт без предварительного уведомления,
            если вы нарушаете данные условия (например, пытаетесь «уронить» наш сервер).
          </p>
        </section>

        <section className="border-t">
          <h2 className={SECTION_TITLE}>7. Контакты</h2>
          <p>По юридическим вопросам и вопросам использования сервиса пишите нам:</p>
          <div className="mt-4">
            <a
              href="mailto:support@doxynix.space?subject=Terms of Service Inquiry"
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
