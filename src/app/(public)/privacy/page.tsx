import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
};

export default function PrivacyPage() {
  return (
    <div className="animate-fade-in container mx-auto max-w-2xl py-12">
      <h1 className="mb-6 text-3xl font-bold">Политика конфиденциальности</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Последнее обновление: {new Date().toLocaleDateString()}
      </p>

      <div className="prose dark:prose-invert space-y-6">
        <section>
          <h2 className="mb-2 text-xl font-semibold">1. Введение</h2>
          <p>
            Добро пожаловать в Doxynix («мы», «наш» или «нас»). Мы уважаем вашу конфиденциальность и
            обязуемся защищать ваши личные данные. Эта политика объясняет, как мы собираем,
            используем и храним вашу информацию при использовании веб-сайта doxynix.space.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">2. Какие данные мы собираем</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Аккаунт:</strong> Имя, Email, Аватар (полученные через GitHub/Google/Yandex
              или Magic Link).
            </li>
            <li>
              <strong>Технические данные:</strong> IP-адрес, тип браузера, куки (для сессий).
            </li>
            <li>
              <strong>Данные репозиториев:</strong> Мы получаем доступ к коду только для чтения
              (Read-Only) исключительно в момент анализа. Мы не сохраняем ваш исходный код в нашей
              базе данных на постоянной основе.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">3. Как мы используем ваши данные</h2>
          <p>Мы используем данные для:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Предоставления сервиса (генерация документации и метрик).</li>
            <li>Аутентификации и поддержки сеанса пользователя.</li>
            <li>Улучшения работы сервиса и аналитики ошибок.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">4. Сторонние сервисы</h2>
          <p>Мы используем надежных партнеров для обработки данных:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Neon (PostgreSQL):</strong> Хранение базы данных пользователей и метрик.
            </li>
            <li>
              <strong>Vercel:</strong> Хостинг и серверная инфраструктура.
            </li>
            <li>
              <strong>Resend:</strong> Отправка транзакционных писем (Magic Links).
            </li>
            <li>
              <strong>GitHub/Google/Yandex APIs:</strong> Для аутентификации и доступа к
              репозиториям.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">5. Безопасность</h2>
          <p>
            Мы принимаем разумные меры для защиты данных, однако ни один метод передачи через
            Интернет не является на 100% безопасным. Мы используем шифрование SSL/TLS для всех
            передаваемых данных.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">6. Контакты</h2>
          <p>
            Если у вас есть вопросы касательно этой политики, свяжитесь с нами по адресу:{" "}
            <a href="mailto:support@doxynix.space" className="hover:no-underline">
              support@doxynix.space
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
