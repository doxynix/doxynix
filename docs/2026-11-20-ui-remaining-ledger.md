# UI — дашборд задач (обновлён 2026-11-20)

> «Сделано» = код изменён, `bun run format`, целевые тесты и `oxlint` проходят.
> Браузер не использовался: проверка визуала за пользователем.

## Сделано в этом батче

| # | Задача | Что именно |
| --- | --- | --- |
| 1 | 2FA: неверный код | маппинг better-auth сообщений — прямо в `useErrorMessage` (отдельных файла, хука и теста нет); `throw new Error(error.message)` |
| 2 | 2FA: крестик перекрывает заголовок | `DialogHeader pr-12` |
| 3 | 2FA: модалка сжимается | сброс состояния отложен на 250ms, таймер отменяется при повторном открытии |
| 4 | Auth-форма схлопывается | три карточки в grid `col-start-1 row-start-1`, высота = max; убран `absolute` |
| 5 | Рейт-лимит | `buildRateLimitBody` отдаёт tRPC-конверт `MEMBER_RATE_LIMITED`; proxy и welcome-flow используют `useErrorMessage` |
| 6 | Поиск: empty-вспышка и прыжки | `keepPreviousData`, общий `min-h-64`, empty только при `!isFetching`, nav и repos на одном debounce |
| 7 | Добавление репо: сдвиг | зарезервированы `min-h-6` под установки и `min-h-5` под `FormMessage` |
| 8 | Календарь | убран `flex` с `td/tr`, `fixedWeeks`, локали date-fns для всех 12 языков, `max-w` у popover |
| 9 | Фильтры | компактный тулбар, reset — иконка с тултипом, единый `gap-2` |
| 10 | `repo/<owner>` | стабильный `grid`-тулбар, `min-w-0`/`truncate` у имени, правый рейл `shrink-0`, убран двойной паддинг карточки |
| 11 | Страница анализа | убрана магическая высота, `flex-col lg:flex-row`, `h-[var(--repo-workspace-height)]` у страницы |
| 12 | Настройки репки | контейнер `flex flex-col gap-6`, свой `settings_repo_delete_card_note` вместо текста диалога, fieldset/Slider disabled, `sm:grid-cols-2` |
| 13 | ScrollArea | `min-h-0` в inspector/audit-sheet/map-overview, ползунок `w-2` и контраст `/25→/40` |
| 14 | Сайдбар | hover-цвет через `twMerge` (без `!`), `mb-0` и `gap-0` в icon-режиме |
| 15 | Тултип карандаша | `AppTooltip` + `focus-visible` |
| 16 | Имя через агента | `$sessionSignal` notify в tool-инвалидации и realtime `userUpdated` |
| 17 | Аватар | blob-превью остаётся, remote preload до переключения, revoke через 5s |
| 18 | Кэш репок | и сайдбар, и поиск — `REPO_LIST_PAGE_SIZE` (10); при пустом поиске ключ совпадает |
| 19 | Код-вьюер: ветка + ошибки + окно | ветка в `getFileContent`; линтер после загрузки языка; счётчик обновляется по факту lint и сбрасывается при смене файла; общая `--repo-workspace-height` |
| 20 | Файл вне диффа | `StagedFileDiffBody` монтируется только при раскрытии; запрос и Shiki — лениво |
| 21 | PR draft: скрытие файлов | `hiddenFiles` + Eye/EyeOff + показ скрытых с бейджем |
| 22 | PR draft: branch/title в ряд | `@container` на шторке + `@[28rem]:grid-cols-2` |
| 23 | PR draft: больше места | файлы свёрнуты по умолчанию, `gap-6 → gap-4`, скролл `min-h-0 flex-1` |
| 24 | Диалог удаления: текст разваливался | `AlertDescription` был `grid`, из-за чего инлайн-`<strong>` становились отдельными строками; теперь обычный block |
| 25 | Full-width CTA | «Сохранить конфигурацию» и «Открыть PR» сжимаются по контенту на десктопе, на мобиле остаются full-width |
| 26 | Карточки: единая система + 12 миграций | `Card` получил `size`/`interactive`/`tone`/`asChild` (дефолт не изменён); мигрированы repo (row/brief), stat (KPI), pull (row), notifications (feed), api-key (row), connection (row/tile), 2FA (security row), profile (header), plan/seats (summary), usage (meters+forecast), pr-config (grouped), danger (row). Попутно `delete-all-repos` больше не прыгает по ширине |
| 27 | Скелетоны под новые карточки | notifications (feed-строки в одной рамке), api-key (row), profile (header + форма), sessions (row) — чтобы загрузка не прыгала в старую геометрию |
| 28 | Полировка по фидбеку | Профиль: без кнопки «Изменить», инпуты сразу в 2 колонки, upload в шапке; график usage: render-якорь на сегодня, линия не рвётся; hover `interactive` — фон вместо серой границы, у danger убран; API-ключ: убрано копирование маски, префикс — компактный чип |
| 29 | Календарь: нормальная верстка range-пикера | Скрыта встроенная навигация по месяцам (`hideNavigation`), один набор стрелок в шапке; контролируемый `month` (стрелки листают на 2 месяца, пресеты прыгают к выбранному диапазону); ячейки 32px, gap между месяцами 24px, outside-days скрыты; шапка start/end выровнена по месяцам; пресеты шире |
| 30 | Дашборд: 6 виджетов аналитики (мокап, п. 01) | Все шесть — `Card size="compact"` с общей шапкой (иконка-тайл, заголовок, действие). Внутри только hairline-строки, без border-в-border. Ecosystem: badge покрытия + radar `h-56` + 3 строки; Risks: точка + описание + мягкий danger-бейдж; Refactoring: две группы (hotspots/coupling) строками; Health: две строки с точками; Languages: stacked bar + строки; Activity: feed-строки. Скелетоны переписаны под ту же геометрию |
| 31 | Дашборд: чек-лист старта и welcome (мокап, п. 02) | Чек-лист — `compact`: шапка (title/desc, прогресс, «Скрыть») + один трек шагов с коннекторами и одной CTA. GitHub-карточка — один `ConnectCard` на 3 состояния (иконка-тайл, заголовок, badge аккаунта, описание, действие справа). Repo picker — карточка без двойных отступов: поиск и refresh снаружи, список внутри, футер с выбранным репо и CTA внутри карточки |
| 32 | Обзор репозитория: сводка и навигация (мокап, п. 03) | Summary больше не «карточка с заголовком Executive Summary»: eyebrow + имя репо + статус/архитектура, описание, стек, футер (обновлено · строки · файлы), docs-кнопка в `CardAction`. Поиск вынесен в compact-карточку под сводкой. «Начать отсюда» — строки зон и точек входа с hover-стрелкой, действие «Открыть на карте» в шапке. Layout: слева сводка+поиск, справа навигация |
| 33 | Обзор репозитория: метрики (мокап, п. 04) | KPI вынесены в отдельный ряд (5 карточек, `xl:grid-cols-5`), у `StatCard` появились optional `meter`/`tone`: значение и полоса окрашены статусом. Repo stats — 2×2, значения 18px. GitHub — 2 колонки label/value с видимыми подписями, topics outline, описание с clamp. Signals — 2×3 metric grid. Языки — bar + строки. Radar заменён на «Снимок качества» (5 осей с цветным значением). Скелетон обзора переписан под новую геометрию, включая п. 03 |
| 34 | Обзор: документация, файлы, риски, тренды (мокап, п. 05) | Docs — 2 колонки строк: иконка, тип (переведён по `DOC_LABEL_KEYS`), версия + `TimeAgo`, badge только для `failed`, вся строка ведёт в docs с `type`. Complex files — до 6 строк, действия на hover, футер «показано N из M». Risks — точки severity + строки, без border-боксов. Trends — обычная шапка, табы в `CardAction`, легенда под графиком, пустое состояние без рамки. Скелетон синхронизирован |
| 35 | Глубокий анализ: три снимка (мокап, п. 06) | `SnapshotsSection` переведён на `Card size="compact"` с общей шапкой (иконка-тайл + title). Quality/architecture — hairline-строки label/value с tone по порогам; onboarding — score + нумерованные шаги. Убраны uppercase-метки, `font-bold text-xl` и 2×2 сетка. Тональность тайла: health/score/cycles |
| 36 | Глубокий анализ: домен и техдолг (мокап, п. 07) | Domain: сущности — hairline-строки (имя, ответственность, complexity-badge) вместо 2×2 плиток, без mono/синего; бизнес-правила — строки с check, без zinc-цветов. Tech debt: строки вместо border-боксов, тип и effort — Title Case через `formatEnumLabel`, effort-badge с подписью, пустое состояние. Заголовки карточек 16px, заголовок секции без tracking |
| 37 | Бэклог рефакторинга (мокап, п. 08) | 8 карточек → одна карточка-список: file + priority + `+N health` + category/description; код «до» раскрывается через `Collapsible`, авторефакторинг — кнопка в строке. Счётчик и суммарный impact в описании карточки |
| 38 | Перф, архитектура, маршруты (мокап, п. 09) | Performance: оранжевая поверхность и таблица → нейтральные hairline-строки с fix-кнопкой; scaling — две секции без синей рамки. Architecture/Reference — заголовки 16px, подписи без uppercase, чипы как были. RisksCard в глубоком анализе приведён к строкам, как в обзоре |
| 39 | Безопасность (мокап, п. 10) | Score в `CardAction` (24px, цвет по значению), описание «скан · N уязвимостей». Уязвимости — строки с severity-точкой, путём и бейджем; remediation в `Collapsible` с pre и компактной кнопкой автопатча. Векторы атаки — футер. Убраны 3xl/black, капс, mono-пути и full-width CTA |
| 40 | PR: затронутое (мокап, п. 11) | Три карточки (зоны/узлы/файлы) → одна с табами и счётчиками. Файлы — строки со статусом, +/−, findings и icon-actions; узлы/зоны — строки с impact-бейджем и переходом на карту. Новый ключ `repo_pull_affected_title` в 12 локалях. Скелетон PR синхронизирован |
| 41 | PR: находки, сводка, влияние (мокап, п. 12) | Комментарии — строки вместо border-карточек, «Исправить» в строке; summary — значения с точечным лидером; impact — 4 метрики без боксов + футер-действия; top findings и linked fixes — hairline-строки. Убраны `uppercase`, `font-black`, лишние рамки |
| 42 | Внешний вид (мокап, п. 13) | Шесть отдельных карточек → одна карточка с секциями и hairline-разделителями. Общие `AppearanceSection`/`AppearanceRow`; theme/color tiles, code preview, shape/sidebar/behavior — одинаковые строки. Убрана дублирующая шапка страницы |
| 43 | Сессии, приглашение, язык (мокап, п. 14) | Сессии — один контейнер со строками, текущее устройство с badge, revoke на hover, «Выйти везде» в футере; skeleton в той же геометрии. Приглашение — центрированная карточка с иконкой и одной CTA. Язык — settings-строка вместо карточки с заголовком |
| 44 | Карта: узел и инспектор (мокап, п. 15) | Узел 384 → 256px, компактная шапка с tile, описание в 1 строку, до 4 метрик строкой, complexity meter. Инспектор — три карточки → полоса значений с hairline-разделителями |
| 45 | Агент (мокап, п. 16) | Убрана Card-обёртка: панель прижата к правому/нижнему краю, `rounded-tl-2xl`, `border-l`/`border-t`. Пустое состояние с подсказками сохранено |
| 46 | Лендинг и авторы (мокап, п. 17) | Landing: убраны `uppercase` и tinted-фон, метрики 36px, график без двойной рамки. High-five: строка с аватаром, лицензиями, пакетами и ссылкой в шапке, без внутреннего border-футера |
| 47 | DESIGN.md v1.1 | Полный каталог компонентов и паттернов, точные радиусы при `--radius` 12px, темы, z-index, motion, a11y по компонентам, governance, adoption status. Значения сверены с `globals.css`, пути компонентов — с кодом |
| 48 | Финальная галерея карточек | `docs/mockups/final-cards.html`: 30 групп по реализованным карточкам, моковые данные, финальные токены. Открыта в Review |
| 49 | DESIGN.md: P0/P1 после ревью «нового разработчика» | Добавлены полные примеры `Card/compact/row`, модель паддингов, `asChild`; `StatusBadge` и словарь `destructive/error/danger`; правило размеров title/description; page pattern; i18n-процесс; исправлены радиусы, тени, z-index, fade-out, Textarea, table header, compact-исключение, веса |
| 50 | Код под DESIGN.md | `StatusBadge` внедрён в connection/repo/summary/session/2FA; `TableHead` 12px; `interactive` убран у некликабельных connection/API-key; `uppercase` убран из продуктовых доков/агента. `repoStatusConfig` переведён на `tone` |
| 51 | `docs/TAILWIND.md` | Полный справочник по каждому Tailwind-параметру: allowed utilities/values, где применять, где запрещено; токены, брейкпоинты, container queries, логические свойства, forbidden/rare, component recipes. Сверено с Tailwind v4 docs |
| 52 | Billing: tooltip прогноза и футеры Plan/Seats | В tooltip на сегодняшнем дне скрыт `forecast` (линия-якорь остаётся, разрыва нет); убрал `font-mono` из значения. В Plan и Seats `CardFooter` получил `mt-auto` — кнопки выровнены по нижнему краю |
| 53 | Страница анализа: двухпанельный layout | Config больше не раздувается на всю ширину: `lg` grid `minmax(0,1fr) / minmax(420px,620px)`, `xl` до 720. Дерево снова занимает левую колонку. Контент карточки скроллится, CTA вынесена в `CardFooter` и всегда видна; doc-плитки 2 колонки до `2xl`, чекбоксы без чёрных точек, заголовок 600 |
| 54 | Один источник локалей | `shared/config/locales.ts` теперь хранит `LOCALE_CONFIG`: код, флаг, OG-locale, ключ перевода. Из него выведены `LOCALES`, `FLAGS`, `LOCALE_LABEL_KEYS`, `isLocale`, `getOgLocale`. `date-fns`-маппинг вынесен в `shared/config/date-fns-locales.ts` (только календарь). `.eloqnt/config.ts` импортирует `LOCALES`; layout, language-switcher и repo-analysis-config больше не дублируют списки |
| 55 | Уведомления: hover и pending локально | Строка уведомления теперь `group/notification`, кнопки — `group-hover/notification`; внешняя карточка больше не показывает экшены всех строк. `disabled`/`isPending` считаются по `pendingIds` конкретного уведомления, а не по общему `isPending` мутации |
| 56 | Метаданные всех страниц | Добавлены `generateMetadata` для Appearance (с canonical) и Invite; ключи `appearance_*`/`invite_*` во все 12 локалей. Аудит `src/app/**/page.tsx`: без метаданных остался только `[...rest]`, который вызывает `notFound()` и использует метаданные not-found |

## Дизайн-система (первый проход)

| Слой | Что сделано |
| --- | --- |
| Токены | `--text-2xs` (11/16), `--text-metric` (28/32); `--radius-2xs` 2px, `--radius-xs` 4px, `--radius-tile` 10px; убран встроенный letter-spacing |
| Типографика | 71 arbitrary font size → шкала (`text-2xs`, `text-xs`, `text-sm`, `text-xl`, `text-metric`); 68 `tracking-*` убрано, включая базовые Card/Badge/Dialog/Sheet |
| Цвета | 53 сырых palette-класса → `success/warning/destructive/info/brand-ai/chart-*`; hex остался только в токенах и брендовых SVG |
| Иконки | из Lucide-иконок убраны `size-4`/`shrink-0`: LucideProvider уже даёт 16px, stroke 1.5, shrink-0 |
| Контроль | `apps/web/scripts/check-styles.ts` + `check:styles` в `validate`: запрет arbitrary text, raw palette, tracking |
| Документация | `docs/DESIGN.md` (EN) + пункт в `AGENTS.md` |

Осталось: `uppercase`-метки, `font-mono` вне кода, `leading-*`, аудит spacing/radii по всем карточкам, галерея всех карточек + light/dark скриншоты.

## Дизайн-исследование карточек

| Файл | Что внутри |
| --- | --- |
| `docs/mockups/2026-11-20-all-cards.html` | 12 карточек: «сейчас» + 3 паттерна на каждую, основы системы, матрица рекомендаций |
| `docs/mockups/2026-11-20-cards.html` | Глубокий разбор уведомлений: current + A/B/C + кнопки + мини-галерея |
| `docs/mockups/2026-11-21-remaining-cards.html` | Второй проход: 19 групп оставшихся карточек (дашборд, обзор, анализ, PR, настройки, сессии, карта, агент, лендинг) — «сейчас» и «предлагаю» |

Паттерны: **Row** (списки), **Section** (формы/настройки), **Metric** (KPI/usage), **Brief** (важное событие), **Feed** (длинный поток). Реализовано в `Card`-вариантах: `size="row" | "compact" | "default"`, `interactive`, `tone`, `asChild`; дефолт не изменён, поэтому остальные 82 использования `Card` не затронуты.

## Остальные Card-использования (82 результата / 38+ файлов)

Из них мигрированы 12 карточек + danger + скелетоны (уведомления, API-ключи, профиль, сессии). Остальные `Card` — это другие поверхности, их не трогали; дефолт `Card` не менялся, поэтому регрессий нет.

| Категория | Файлы | Что делать |
| --- | --- | --- |
| Секционные карточки уже по дефолту | `welcome-flow/*`, `invite-page-card`, `language-switcher`, `repo-analysis-config`, `pr-details-summary`, большинство `appearance/*` | Оставить; только точечно `CardAction`/футеры, если понадобится |
| Analytics / dashboard | `analytics-widgets` (6), `repo-overview` (9), `repo-analytics-cards` (4), `repo-analytics-sections` (8), `repo-trends-widget` | Второй проход: `CardAction` вместо `flex flex-row`/`pb-2`, единый ритм, `tabular-nums` |
| PR details | `repo-pull-details-content` (8) | Второй проход: шапки с `border-b`/`pb-4` → `CardAction` + футер |
| Map | `repo-node-inspector`, `repo-node` | Специальные поверхности; не форсить в общий ритм |
| Marketing / public | `landing/analytics-section`, `high-five-card` | Отдельный визуальный язык; не трогать |
| Agent | `features/agent/ui/agent.tsx` | Это layout-shell (`p-0`), не контентная карточка |
| Skeletons | notifications, api-key, profile, sessions — выровнены; остальные page-level | Проверять при миграции соответствующей карточки |

## Отложено

| Задача | Причина |
| --- | --- |
| Мультивыбор файлов для аудита | решение пользователя |
| Keyset-пагинация веток + верстка длинных имён | решение пользователя |
| Ленивая подгрузка папок дерева | отложено пользователем |
| «Развернуть все / Свернуть все» | отложено пользователем |
| Dot pattern | отложено пользователем |
| Съезжающий текст «Удалить все репозитории» | не воспроизведён на 1490px; после правок тулбара/карточки нужна перепроверка |
| `/home` и root-редирект | снято: страница удалена, proxy откатан |
| `Popover modal={true}` | снято: в коде нет использований |

## Проверка

- `bun run format` — чисто.
- Целевые тесты: **6 файлов, 60 тестов — passed**.
- `lint:locales` — 12 файлов, OK.
- `oxlint` — 0 errors (5 старых warning'ов в несвязанных тестах).
- `type-check` — `No type errors in 1,411 files`.
- Не закоммичено: нет номера DXNX для ветки.
