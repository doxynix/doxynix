# UI-аудит `apps/web` — план правок

> Статус: только исследование. Код не менялся.
> Метод: чтение кода + прогон `localhost:3000` в браузере под залогиненным пользователем (`karen.avakov2`, workspace PRO).
> Пути ниже — относительно `apps/web/`, если не указано иное.

## 0. Что подтверждено в браузере

| Симптом | Подтверждение |
| --- | --- |
| «Сначала скопируйте новый ключ» / «Ротирован — действует до» чёрные | В dark-теме `--status-warning-foreground` = `lab(1.89% …)` (почти чёрный). Токен предназначен для текста **на сплошной заливке**, а используется как обычный текст на `bg-warning/10`. |
| Прогноз на сегодня дублирует факт | `usage-forecast.ts:134-135`: при `day === daysElapsed` forecast = percent (то же, что actual). |
| Съезжает текст у «Удалить все репозитории» | На `repo/[owner]` при открытии диалога геометрия не меняется (замерено). Гарантированный скачок есть в `delete-all-repos-card`: скелетон `w-50` (200px) → реальная кнопка `w-fit`; плюс сам тулбар `flex-wrap` нестабилен из-за ширины фильтров/даты. |
| Нет почты в «Подключено как» | Живая карточка: `GitHub · Подключено · Подключено как · Отключить` — плейсхолдера `{identity}` нет в переводах. |
| Глаз в журнале аудита не загорается | Hover-цвет висит на самой svg (`text-muted-foreground hover:text-foreground`), а кнопка 36×36; иконка 16×16. Вне иконки hover не виден. |
| Краш `repo-floating-card` | В `STATS_CONFIG` нет `configCount`, сервер всегда его отдаёт и >0 у конфигов (`package.json`, `tsconfig.json` и т.п.) → `config.icon` = undefined. |
| Модалка сжимается при закрытии | 2FA-диалог: высота 578px → 300px сразу после клика по X, при `data-state="closed"` (анимация ещё идёт). `onOpenChange` мгновенно чистит `totpUri`/`backupCodes`. |
| Кнопка X перекрывает заголовок | Замерено: title `x=549…947`, close `x=923…955`; заголовок «Настройка двухфакторной аутентификации» уходит под кнопку. |
| Поиск мигает «Ничего не найдено» и прыгает | Замер: 0–245ms высота 357px; 328ms — «Ничего не найдено», высота 257px; 489ms — результаты вернулись, высота 245px. |
| Календарь свёрстан странно | Английские `November 2026` / `Su Mo Tu…` в русском UI; два месяца + пресеты в popover 691px; flex на `<td>`/`<tr>` ломает табличную сетку. |
| ScrollArea: контент едет, ползунок нет | На `/code` Radix-viewport имеет `scrollHeight == clientHeight` (564), а скроллит внутренний div (527/532); у страницы 789/811 — «прыжок» в край. |
| `/` для залогиненного | `/` → `/ru` → лендинг с публичным хедером. `/ru/dashboard` доступен; `/ru/home` отсутствует. |
| Прозрачность модалок | Сквозь 2FA-диалог видно текст карточек под ним: `--popover` = alpha 0.92 и **нет** `backdrop-blur`. |

---

## 1. P0 — баги, ломающие данные/читаемость (делать первыми)

### 1.1 Регистр `DELETE` не проверяется
- `shared/ui/kit/confirmation-field.tsx:11-13` — `phraseMatches()` делает `toLowerCase()` с обеих сторон.
- Затрагивает: удаление аккаунта (`DELETE`), все репозитории (`DELETE ALL`), репо/owner/email/имя ключа.
- Фикс: `value.trim() === phrase.trim()`; если для имён нужен регистронезависимый ввод — флаг `caseSensitive` и включить его для `DELETE`/`DELETE ALL`.
- Тест: `phraseMatches("delete","DELETE") === false`, `"DELETE" === true`, пробелы по краям игнорируются.
- Попутно: в `ConfirmationField` `<Label>` оборачивает `<p>` (невалидный HTML) — заменить на `<div>` + `aria-describedby`.

### 1.2 Чёрный текст warning-алертов
- `features/settings/ui/api-keys/rotate-api-key-dialog.tsx:93` — `text-warning-foreground` на `bg-warning/10`.
- `entities/api-key/ui/api-key-card.tsx:59` — тот же токен на `bg-card`.
- Фикс: заголовок — `text-foreground`, тело — `text-muted-foreground`, акцент — `text-warning` / `border-warning/30`. Токен `*-foreground` использовать только на сплошном `bg-warning`.

### 1.3 «Подключено как» без почты
- `messages/*.json` (12 локалей): `settings_auth_connected_as` = `"Connected as"` / `"Подключено как"` — нет `{identity}`.
- Компонент уже передаёт `identity` (`features/settings/ui/connections/auth-providers-list.tsx:125`).
- Фикс: `"Connected as {identity}"`, `"Подключено как {identity}"` во все локали.
- Данные: `account.email` может быть `NULL` у старых строк (миграция без backfill). Нужен fallback на `user.email` в `server/modules/users/user.service.ts:191-215` или backfill.

### 1.4 Глаз в журнале аудита
- `entities/audit-log/ui/audit-log-sheet.tsx:57-72`, `features/admin/ui/admin-audit-table.tsx:157-166`.
- Убрать `text-muted-foreground hover:text-foreground` с `<Eye>/<Database>`; hover — на кнопку (`hover:text-foreground`), плюс `focus-visible:opacity-100` (сейчас кнопка `opacity-0` без фокус-состояния).

### 1.5 Краш карточки файла в документации
- `features/repo-docs-viewer/ui/repo-floating-card.tsx:73-84,148-150,253-254`.
- Причина: `Object.entries(node.stats)` + unchecked cast; `configCount` отсутствует в `STATS_CONFIG` → `config.icon` падает.
- Фикс:
  - добавить `configCount` (иконка `Settings2`/`FileCog`, ключ `stats_configs`);
  - не кастовать, а фильтровать: `const config = STATS_CONFIG[key as keyof …]; if (config == null) return null;` — тогда новые ключи сервера не роняют UI;
  - так же защитить `MARKERS_CONFIG`;
  - `node == null` после загрузки → компактный empty-state вместо вечного скелетона;
  - позиционирование: считать координаты относительно скролл-контейнера, а не `window.scrollY` (в приложении скроллится внутренний div, поэтому карточка уезжает).

### 1.6 2FA: неверный код → «Что-то пошло не так»
- `features/auth/model/use-two-factor-verification.ts:33-62` и `features/settings/ui/connections/two-factor-card.tsx:55-110` бросают `new Error(error.message)`, теряя `code/status` better-auth.
- `use-error-message.ts` понимает только tRPC `messageCode`.
- Фикс: сохранять исходный объект (`throw error`) и добавить маппинг better-auth кодов: `INVALID_CODE`, `INVALID_BACKUP_CODE`, `OTP_HAS_EXPIRED`, `TOTP_NOT_ENABLED`, `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE`, `ACCOUNT_TEMPORARILY_LOCKED`. Ключи — в `Errors` всех локалей.
- Альтернатива: отдельный `twoFactorErrorMessage(code)` в `features/auth/model`.

### 1.7 Рейт-лимит: «что-то пошло не так»
- `proxy.ts:51-66` отдаёт `{error, message}` **без** `messageCode` → tRPC-клиент не может локализовать.
- Фикс: вернуть tRPC-совместимый конверт (`data.messageCode = MEMBER_RATE_LIMITED`) + `Retry-After`/`X-RateLimit-*` уже есть.
- Плюс места, где ошибка выбрасывается: `welcome-flow/model/use-github-install.ts:30,38`, `use-welcome-flow.ts:87,117,140,151` → `useErrorMessage()(err)` вместо `t("github_error")`.
- Тост: `toast.error(useErrorMessage()(err))`; для 429 — `description` с «повторите через N сек» из `X-RateLimit-Reset`.

### 1.8 Прогноз usage: убрать точку «сегодня»
- `features/manage-subscription/model/usage-forecast.ts:134-135`.
- Удалить ветку `day === daysElapsed` (оставить `null`); маркер «сегодня» рисуется отдельно `ReferenceDot` (`usage-forecast-chart.tsx:271-278`).
- Проверить `connectNulls={false}`: линия прогноза начнётся со следующего дня — это ожидаемо.
- Тест: `chartRows.find(r => r.day === daysElapsed)?.forecast === null`; последняя точка по-прежнему `daysTotal`.

### 1.9 Код-вьюер: ложные ошибки и не та ветка
- `entities/repo/model/editor-extensions.ts:103-122` — любой error-node Lezer становится `severity:"error"`; линтер включён до загрузки языка.
- `entities/repo/ui/repo-code-editor.tsx:157-189` — `diagnosticCount(state)` читается сразу при `docChanged`, а `@codemirror/lint` дебаунсит 750ms → счётчик от предыдущего файла.
- `features/repo-code-viewer/ui/repo-code-container.tsx:39-44` — ветка не передаётся в `getFileContent` (роутер её поддерживает); то же в `features/repo/ui/staged-file-diff.tsx:115-120`.
- Фикс:
  - передавать `branch`;
  - счётчик обновлять по завершении линта (подписка на `diagnostics`/`onStateChange` или собственный `linter` с `delay`);
  - recovery-узлы не показывать как ошибки (максимум warning), либо отключить universal linter до готовности парсера;
  - сбрасывать диагностику при смене файла (`setDiagnostics(state, [])`).

---

## 2. P1 — UX-баги (волна 2)

### 2.1 Модалки: закрытие, крестик, прозрачность
- **Сжатие**: не сбрасывать состояние в `onOpenChange(false)`.
  - `two-factor-card.tsx:176-183` — отложить `setBackupCodes(null)/setVerificationCode("")/setTotpUri("")` на 200–300ms (как уже сделано в `create-api-key-dialog.tsx:55-64`).
  - `create-repo-dialog.tsx:127-131` — отложить `form.reset()`/`setShowSuggestions(false)`.
  - `danger-action-dialog.tsx:64-70` — чистить `phraseInput` после закрытия, а не во время рендера.
  - Для пошаговых диалогов задать стабильный `min-h` контента.
- **Крестик**: `dialog.tsx:81-89` абсолютный. Дать `DialogHeader` `pr-12` (или вынести close в header-flex) — иначе hover-подложка накрывает текст.
- **Прозрачность**: `--popover` alpha 0.96/0.92 без blur → сквозь модалку видно контент.
  - Рекомендация: `DialogContent`/`SheetContent` — непрозрачный `bg-card`; `glass-panel` (blur 16px) оставить хедеру/сайдбару/тостам; либо добавить `backdrop-blur-xl` всем overlay-поверхностям (дороже по GPU).
- Анимации: 200ms выход / 300ms вход — в рамках бюджета; добавить `prefers-reduced-motion` (сейчас его нет в диалогах).

### 2.2 Поиск по сайту
- `widgets/app-header/ui/app-command-menu.tsx:132-176,268`.
- Фикс:
  - `placeholderData: keepPreviousData` для репозиториев;
  - «Ничего не найдено» только при `!isLoading && !isFetching && total === 0`;
  - скелетон-строки на время загрузки;
  - фильтровать навигацию тем же `debouncedSearch`;
  - `CommandList` — стабильный `min-h` (например 320px) или фиксированная высота панели;
  - sentinel рендерить только при `hasNextPage` и не занимать место, когда не грузит.

### 2.3 Сайдбар: hover и дырки в icon-режиме
- `widgets/app-sidebar/ui/sidebar-link.tsx:33-40` + `shared/ui/core/sidebar.tsx:590-605`.
- Конфликт: `hover:text-foreground` vs `hover:text-sidebar-accent-foreground`; фон форсится `!`, текст — нет.
- Фикс: один токен + `hover:text-foreground!` (или state-based класс), без дублирования.
- Дырка: `app-sidebar.tsx:110` `mb-1` у `CollapsibleTrigger`, а `SidebarGroupLabel` в icon-режиме гасит только высоту (`sidebar.tsx:523`). Добавить `group-data-[collapsible=icon]:mb-0` и обнулить `gap` группы/меню.
- Если речь про панель агента — тот же принцип: hover-цвет на кнопке, а не на svg; проверить `features/agent/ui/agent-sidebar.tsx`.

### 2.4 Агент: тултип карандаша и мгновенное имя
- Тултип: `features/agent/ui/agent-message.tsx:322-331` — обернуть в `AppTooltip content={tCommon("edit")}`, как retry рядом. Добавить `focus-visible:opacity-100`.
- Имя: `features/agent/model/agent-config.ts:139-148` инвалидирует `user.me` (его никто не читает) и делает «сырой» `authClient.getSession`, который не обновляет `useSession`.
  - Фикс: после `updateUserProfile` вызвать `authClient.updateUser({ name })` (как `use-profile-actions.ts:43-47`) или `authClient.$store.notify("$sessionSignal")`;
  - realtime `userUpdated` (`app/_components/realtime/handlers/account.ts:16-19`) — тоже обновлять сессию.

### 2.5 Аватар: двойное превью и мигание
- `features/settings/model/profile/use-profile-actions.ts:130-177` + `profile-card.tsx:25-31`.
- Blob-URL ставится → затем remote URL → сессия перезаписывает `avatarUrl` → `AppAvatar` снова показывает skeleton.
- Фикс: пока `isProcessing`, синк сессии не перетирает превью; держать blob до `onLoad` remote; `revokeObjectURL` после подмены, а не в `finally`; либо преloadить remote перед сменой `src`.

### 2.6 Календарь
- `shared/ui/core/calendar.tsx`.
- Убрать `flex` с `day`, `week`, `weekdays` — сейчас `<td>`/`<tr>` выпадают из табличной модели.
- Добавить `fixedWeeks` (высота не прыгает), один блок навигации на 2 месяца, `captionLayout="dropdown"` для года.
- Локаль: передавать `locale` из next-intl/date-fns — сейчас месяцы и дни английские.
- Popover: `max-w-[calc(100vw-2rem)]`, на узких экранах один месяц; пресеты — отдельной колонкой с разделителем.
- Триггер даты — стабильная ширина (сейчас текст меняется `Любая дата` → `01.01—02.02` и рвёт тулбар).

### 2.7 ScrollArea
- `shared/ui/core/scroll-area.tsx` + сайты:
  - `features/repo-map/ui/repo-node-inspector.tsx:170` — нет `min-h-0 flex-1` → Root высотой с контент, viewport не скроллится (ползунок мёртв);
  - `entities/audit-log/ui/audit-log-sheet.tsx:134` — `flex-1` внутри grid бесполезен;
  - `features/repo-map/ui/repo-map-overview.tsx:21` — `overflow-y-auto` без `min-h-0`;
  - `features/repo-code-viewer` — Radix ScrollArea (564/564) оборачивает дерево, а скроллит внутренний div (`react-arborist`) → ползунок не связан с контентом.
- Принцип: **один владелец скролла**. Либо панель — Radix ScrollArea с `min-h-0 flex-1`, либо нативный `overflow-auto` (тогда Radix убрать).
- Убрать магические высоты `calc(100dvh-260px)` в `repo-setup.tsx:26`, docs/code — из-за них у страницы остаётся 20–30px «прыгающего» overflow.
- Контраст ползунка: `bg-foreground/12` → `/20…/25`, ширина 2px.

### 2.8 Ветки: keyset + длинные имена
- `server/core/github/github-api.ts:206-212` — `octokit.paginate` тянет **все** ветки; UI пагинации нет.
- REST не умеет cursor. Варианты:
  1. GraphQL `refs(first, after, refPrefix:"refs/heads/")` + `pageInfo.endCursor` — честный keyset;
  2. хранить page-токены REST у себя (`page`/`per_page` → cursor = page).
- UI: `entities/repo/ui/repo-branch-selector.tsx:54-57` — `truncate` на flex-контейнере не работает; обернуть имя в `<span className="min-w-0 truncate">`, грид `grid-cols-[minmax(0,1fr)_auto]` в `repo-code-tree.tsx:77`.
- В списке — `min-w-0 truncate` + `title`, бейдж `shrink-0`, `CommandEmpty` перенести в правильную ветку.

### 2.9 Дерево файлов: ленивая загрузка
- `github-api.ts:269-286` — один `recursive=1` на весь репозиторий; `truncated` игнорируется (cap 100k/7MB).
- Фикс: `git.getTree({ tree_sha, recursive: 0 })` по папке, кэш `repo+branch+sha`, догрузка при раскрытии; `truncated` → явный баннер «дерево обрезано».
- «Развернуть/свернуть все»: `repo-code-tree.tsx:58-72`, `repo-file-tree.tsx:31-45` — `startTransition` вокруг императивного `openAll()` бесполезен; кнопки отключать до готовности `treeApi` (сейчас «ничего не делают» на первом рендере), для больших деревьев — батчить/виртуализировать.

### 2.10 Загрузка файла вне диффа + PR draft
- `features/repo/ui/pr-draft-sheet.tsx:204-217` + `staged-file-diff.tsx:115-132`: каждый файл сразу грузит целый blob и считает diff + 2× Shiki. Нужно: свернуть строки по умолчанию, `enabled` по раскрытию, запрашивать содержимое по требованию.
- Кнопки/ряд: форма `flex flex-col` (`pr-draft-sheet.tsx:220-260`) — сделать `@container` на `SheetContent` и `@[28rem]:grid-cols-2` для branch/title (ширина шторки 360–900, `sm:` тут не подходит).
- Скрытие файлов: локальный `hiddenFiles: Set<string>` + eye-кнопка (не путать с unstage, который удаляет из Redis).
- Мультивыбор аудита: чекбоксы + батч-эндпоинт; сейчас `quickFileAudit` только один файл. Для PR — `openPullRequest.input.filePaths?: string[]` и фильтрация в `fixes.service.ts:296`.
- Ошибка `openPullRequest` (`{success:false,error}`) сейчас не показывается — выводить `data.error`.

### 2.11 Настройки репозитория
- `app/[locale]/(private)/dashboard/repo/[owner]/[name]/settings/page.tsx:27-32` — нет контейнера (`flex flex-col gap-6`), поэтому карточки слипаются.
- `delete-repo-card.tsx:17-21` — скопированы тексты «Delete All Repositories».
- `pr-analysis-config-card.tsx:233-240` — switch мутирует сразу, остальное по Save → несогласованная модель; `pointer-events-none opacity-75` не блокирует клавиатуру (нужен `disabled`).
- Сетка `grid-cols-2` без breakpoint; `mb-6/mb-8` внутри `gap-6` даёт 48px.

### 2.12 Страница `repo/[owner]`
- Тулбар (`repo/[owner]/page.tsx:49-56`): `flex-wrap` + `justify-center xl:justify-between`, ширина фильтров/даты меняется → строка перекладывается.
  - Фикс: `grid` с固定 колонками или `flex` + `shrink-0` на action-слоте, `min-h` для фильтров, кнопка без «сырого» пробела перед иконкой (`DeleteByOwnerDialog:51`).
- Карточки: убрать двойной паддинг (`repo-card.tsx:43` `p-4` + `CardContent px-6` = 40px), дать `min-w-0` правому рейлу, `truncate` — на текст, а не на `flex-wrap`-контейнер.
- Фильтры: свести к одному тулбару — поиск + 2 селекта (статус/видимость) + сортировка + дата; активные фильтры — чипами с X; на мобиле — кнопка «Фильтры (n)» → Sheet. Сейчас 4 контрола + reset в одну строку.

### 2.13 Страница анализа
- `features/repo-setup/ui/repo-setup.tsx:23-41`: магическая высота `100dvh-260px`, нет `lg:flex-row`, `isBusy` включает загрузку дерева → кнопка «Запустить» крутится зря.
  - Фикс: grid/flex с `min-h-0`, `flex-col lg:flex-row`, отдельные `isStarting`/`isTreeLoading`, ошибка дерева с retry (`use-repo-tree-data.ts` теряет `error`), `maxLength` у инструкций.
- Результат (`repo-analytics/ui/repo-overview.tsx:268,500-503`): `col-span-4` в 1–2-колоночном гриде → горизонтальный overflow на `md`; `grid-cols-3` для 4 статов → сирота. Починить сетки, добавить навигацию по секциям.

### 2.14 Прочее
- **Dot pattern**: `shared/ui/visuals/dot-pattern.tsx` рисует `fill`, а лейауты передают `stroke-*` — цвет не применяется. Заменить на `fill-border/40`, шаг 24–28, оставить только на публичном лендинге (в onboarding убрать — мешает форме). Либо убрать совсем и оставить один radial-glow.
- **Съезжающий текст в `delete-all-repos-card`**: скелетон `w-50` → реальная кнопка `w-fit`; заменить на невидимый реальный лейбл/`min-w`, чтобы ширина не менялась.
- **Модалка добавления репо**: зарезервировать `min-h-6` под ряд установок, `min-h-5` под `FormMessage`; центрированный диалог с контентной высотой заменить на `items-start` + `max-h` + внутренний скролл.
- **Странности диалогов**: после закрытия 2FA-диалог остался в DOM в `data-state="closed"` (285px) — проверить, что `animationend` доходит и Presence размонтирует; иначе он мешает фокусу/шорткатам.
- **`Popover modal`**: нигде не используется. Если включать — только на `Popover.Root` (не `Content`), и понимать, что это `aria-hidden` + scroll-lock + focus trap; для дейт-пикера/поиска это вредно. Оставить `modal={false}`.

---

## 3. Дизайн-система карточек

Сейчас: 11 из 12 — `Card`, но 4 размера заголовка, 5 разных gap между карточками, 9 способов разместить действие, `CardAction`/`CardFooter` не используются, `repo-pull-card` — не `Card`, а `<Link>`.

### 3.1 Решение
- Остаёмся на `Card`, расширяем его `cva`-вариантами (не вводим третий примитив).
- `Item` — только для строк **внутри** карточки (биллинг, метаданные ключа, usage).
- Добавить в `shared/ui/core/card.tsx`:
  - CSS-переменные `--card-pad-x/--card-pad-y`; `CardHeader/Content/Footer` используют `px-(--card-pad-x)`, `Card` — `py-(--card-pad-y)`. Это убирает класс багов «двойной паддинг».
  - варианты: `layout: section | row`, `size: default | compact`, `interactive`, `tone: default | muted | selected | danger`;
  - `CardMedia` (иконка/аватар, `shrink-0`), `asChild` (для `Link`), `data-slot`.
- Анатомия: `Card → CardHeader (Media | Title+Description | CardAction) → CardContent → CardFooter`.
- Токены: section 24px, row 16px; заголовок `text-base font-semibold` (section) / `text-sm font-medium` (row); метаданные `text-xs` + `line-clamp-1` + `title`; все числа — `tabular-nums`; hover — `border-border-strong` + `transition-standard`; без теней.
- Межкарточные отступы: списки/фиды — `gap-4`, настройки/биллинг — `gap-6`.

### 3.2 Миграция
| Приоритет | Файл | Что |
| --- | --- | --- |
| P0 | `entities/connection/ui/connection-card.tsx` | `layout="row"`, `CardMedia size-9`, truncate заголовка, `tone` вместо `text-success`, `shrink-0` на action (сейчас UA-строка ломает строку) |
| P0 | `entities/repo/ui/repo-card.tsx` | убрать `p-4`, `min-w-0` левой колонке и правому рейлу, ссылки в `CardAction`, `focus-visible:opacity-100` |
| P1 | `entities/pr/ui/repo-pull-card.tsx` | `<Card asChild layout="row" interactive>` вместо голого `Link` |
| P1 | `entities/notification/ui/notification-card.tsx` | `tone`, `line-clamp-2` телу, `border-l-4` → `tone="accent"`/точка, убрать overlay-ловушку с `z-10` |
| P1 | `entities/api-key/ui/api-key-card.tsx` | `CardAction` (иконки в ряд), метаданные — обычные строки, чипы → `AppBadge` |
| P2 | `stat/seats/plan/usage/profile/pr-analysis/two-factor` | только ритм/размеры: `CardAction`, `CardFooter`, `tabular-nums`, убрать `mb-*`/`pb-2`/`space-y-0` |
| P2 | `empty.tsx` + 4 скелетона | один `CardSkeleton`, `Empty` в рамке карточки (`border`, `rounded-2xl`) |

---

## 4. Роутинг: `/`, `/home`, `/dashboard`

> **Статус (2026-11-20): итоговое решение — роутинг не меняем.**
> Вариант A был реализован (редирект `/` → `/dashboard` + алиас `/home`), затем откатан: `/home` удалён как ненужный, proxy-логика убрана.

Сейчас (проверено):
- `/` → `/ru` (next-intl) → лендинг, **даже если пользователь залогинен**.
- `/ru/dashboard` — защищён `proxy.ts` + серверная проверка сессии.
- `/ru/home` — 404 (страницы нет).
- `/ru/auth` для залогиненного редиректит на `/ru/dashboard`.

### Вариант A: `/` остаётся лендингом, авторизованных уводим на дашборд
- В `shared/lib/proxy-routing.ts` добавить: `pathWithoutLocale === "/" && hasToken → `${localePrefix}/dashboard`` (если когда-нибудь понадобится).
- `/home` **не добавляем**: страница удалена как лишняя, алиас не нужен.
- SEO не страдает: корень по-прежнему отдаёт контент анонимам, sitemap не меняется.

### Вариант B (буквально как просил): лендинг на `/home`
- Перенести `(public)/page.tsx` → `(public)/home/page.tsx`.
- В proxy: `/` → `hasToken ? /dashboard : /home`.
- Обновить: `PUBLIC_ROUTES` (`path: "home"`), `sitemap.ts`, canonical/OG, ссылки `href="/"` в `public-header-cta-slot.tsx:20`, `not-found.tsx:31`, `forbidden.tsx:28`.
- Минус: корень перестаёт быть индексируемой страницей (302 на `/home`).

Оба варианта не требуют трогать `[locale]`-сегмент: localePrefix `as-needed`, редирект должен сохранять префикс.

---

## 5. Кэш и данные

- **Сайдбар vs поиск**: `repo.getSlim` вызывается с разными входами (`{limit:10}`, `{limit:5,search}`, `{}`, `{limit:1}`) → разные ключи. Ввести фабрику `repoInfiniteOptions` с одинаковым `{limit: REPO_LIST_PAGE_SIZE}` для сайдбара/поиска/префетча; поиск — отдельный ключ + `keepPreviousData`.
- **Инвалидация**: `use-repo-actions.ts` уже бьёт `pathFilter()` по `getSlim`, realtime `repoUpdated` тоже. Добавить `refetchOnWindowFocus: true` не надо; достаточно, чтобы открытие палитры рефетчило stale-запрос.
- **Имя пользователя**: см. 2.4.

## 6. Проверка после правок

1. `bun run format && bun run lint && bun run type-check`.
2. `bun run validate` (включая i18n: новые ключи во все 12 локалей, `lint:locales`).
3. Юнит-тесты: `phraseMatches`, `usage-forecast` (нет прогноза на сегодня), `STATS_CONFIG` покрывает все ключи `StructureNodeStats` (type-level).
4. Ручной прогон в браузере:
   - `/` анонимно и залогиненно;
   - `repo/[owner]`: тулбар на 1280/360, открытие диалога удаления;
   - 2FA: открыть → закрыть (нет сжатия), hover на X;
   - поиск: ввод «quas» — нет вспышки empty, высота стабильна;
   - календарь: русские месяцы/дни, 2 месяца, нет overflow;
   - code viewer: ветка, счётчик ошибок после смены файла;
   - docs: hover на `package.json` — карточка не падает;
   - connections: «Подключено как <email>»;
   - audit: hover по всей кнопке глаза.

## 7. Решения, которые нужны от тебя

1. **Карточки**: плоские hairline (как сейчас) или добавить тень/приподнятость? Мигрировать все 12 сразу или волнами (сначала P0-две)?
2. **Прозрачность**: непрозрачные модалки (рекомендую) или glass c `backdrop-blur`?
3. **Роутинг**: вариант A или B? — **решено: не меняем, `/home` удалён**.
4. **Мультиаудит**: выбирать только staged-файлы или любые файлы репозитория? Батч-эндпоинт или последовательные вызовы?
5. **Ветки**: GraphQL-cursor (честный keyset) или REST `page`-токены (меньше изменений на сервере)?
