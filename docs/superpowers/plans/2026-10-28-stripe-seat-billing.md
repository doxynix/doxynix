# Stripe Seat Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Внедрить B2B-подписку по местам для Workspace: monthly USD, Stripe Checkout/Billing, надёжные webhooks, entitlements, dunning, налоги, риск-события и реконсиляция.

**Architecture:** Stripe-hosted Checkout и Billing API управляют деньгами; локальная БД хранит tenancy, бизнес-правила и проекции Stripe. Snapshot webhook только принимает и ставит событие в очередь; worker читает актуальный объект из Stripe и атомарно обновляет проекцию. Это устраняет зависимость от порядка событий и не превращает success page в источник доступа.

**Tech Stack:** Bun, Next.js 16 Route Handler, TypeScript strict, Stripe Node SDK, Prisma 6 + ZenStack 2, PostgreSQL 18, Trigger.dev 4, Vitest, tRPC, Doppler.

**Spec:** этот документ; разделы 1–15, 18–19 являются спецификацией, раздел 17 — планом её реализации, раздел 20 — обязательным предшествующим эпиком (Workspace tenancy).

## Global Constraints

- На старте: платный продукт — B2B per-seat subscription, США, USD; бесплатный `HOBBY` — один участник. Выбрано пользователем.
- Только Bun; никаких npm/pnpm/yarn. Полный gate: `bun run validate`.
- Stripe API и webhook endpoint фиксируются на `2026-09-30.endive`; это текущая версия по [API versioning](https://docs.stripe.com/api/versioning).
- Изменяем `prisma/models/*.zmodel`, но никогда не редактируем вручную сгенерированный `apps/web/prisma/schema.prisma`.
- Все локальные PK: `String @id @default(dbgenerated("uuidv7()")) @db.Uuid`; сортировка по `createdAt`, не по UUID.
- Новые server slices: `workspaces` и `billing`; cross-slice imports запрещены. Общий entitlement read model находится ниже slices.
- Trigger tasks: только `apps/web/src/server/modules/billing/tasks/*.task.ts`.
- Секреты и RAK: только Doppler; никаких ключей, webhook secrets, payload или card/tax/address data в логах.
- В задачах BILL-03…21 пользовательского UI нет: только tRPC API и Stripe-hosted Checkout/Portal. Экраны: WS-05 (воркспейсы и участники) и BILL-22 (оплата); они добавляют ключи во все 12 локалей.
- Каждое утверждение о Stripe API ниже имеет ссылку на docs.stripe.com; неподтверждённое помечено `[unverified]`.
- `bun --filter <pkg> db:migrate --name X` **не работает**: Bun дописывает `--name X` в конец строки скрипта, и аргумент попадает не в `migrate dev`. Правильно: `bun --filter @doxynix/web db:generate && (cd apps/web && bun prisma migrate dev --name X)`.

---

## 1. Scope & non-goals

### Scope

- Один Product/Price для плана `PRO`: recurring monthly, USD, licensed quantity = seats. Product/Price IDs задаются конфигурацией окружения; код не создает catalog на каждый запрос.
- Один Workspace = один Stripe Customer; одна текущая Subscription, история прежних подписок сохраняется.
- Stripe-hosted Checkout для первой подписки и Customer Portal для payment method, invoices и отмены. Для recurring billing выбран Billing API + Checkout, а не ручной PaymentIntent flow ([Billing integration](https://docs.stripe.com/billing/subscriptions/design-an-integration), [Checkout subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted)).
- Workspace — единственная модель владения. Tenancy-эпик (раздел 20) выполняется **до** биллинга: `Repo.userId` становится `createdByUserId`, владение ресурсами — `workspaceId`.
- Webhooks, дедупликация, state projection, entitlements, immediate plan/seat changes, dunning, Stripe Tax, refunds/disputes/fraud alerts, nightly reconciliation, sandbox tests.
- Режим `charge_automatically`; счета и квитанции предоставляет Stripe. Параметр `payment_method_types` не передаём: eligible methods управляются Dashboard ([dynamic payment methods](https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods)).

### Non-goals

- Usage-based/one-time payments, отдельный платный тариф для одиночек, non-USD, продажи вне США, annual prices, trials, coupons, credits как продуктовая валюта.
- Кредиты и overage-биллинг (доплата за превышение квоты): фаза 2, через Metronome/usage-based. В этом плане лимиты только жёсткие (`403`), без допродажи.
- Отложенные downgrade, Subscription Schedules, несколько текущих подписок на Workspace, несколько SubscriptionItems.
- `send_invoice`, банковские переводы, manual invoice collection, Connect, marketplace, налоговая регистрация через код.
- Embedded Checkout/Payment Element, собственная карточная форма, публичная pricing-страница и сравнение тарифов, invitation emails. Минимальный billing-экран входит в BILL-22.
- Полноценный бухгалтерский учёт, payout reconciliation, double-entry GAAP ledger, revenue recognition.
- Автоматические refunds, dispute evidence submission, автоматическая отмена после refund/dispute.
- Запуск биллинга до завершения tenancy-эпика (раздел 20): `quantity` привязывается к числу активных membership только после WS-06. Промежуточных nullable-полей и второго контура владения не существует.
- Удаление tenant с финансовой историей и экспорт налоговой отчётности.

## 2. Actors & tenancy

| Actor | Права |
|---|---|
| `Workspace OWNER` | Checkout, Portal, plan/seat change, cancellation, просмотр billing status/ledger; управление members. |
| `Workspace MEMBER` | Использует разрешённые entitlement operations; не изменяет billing. |
| Personal аккаунт | Workspace с единственным `OWNER`-member. Отдельного типа/флага/legacy-контура нет: репозитории принадлежат воркспейсу так же, как у команды. |
| Global `ADMIN` + 2FA | Replay dead-letter, resolve issue, запуск reconciliation; не получает право скрыто менять подписку клиента. |
| Stripe | Единственный внешний actor webhook; запрос принимается только после проверки подписи. |
| Trigger.dev workers | Системные canonical reads и DB projections через `prisma`; не имеют пользовательской ZenStack identity. |

Правила tenancy:

1. Одна сущность — Workspace. Личное и командное различает **план**, а не тип: `HOBBY` (1 участник, приглашения запрещены), `PRO` (self-serve, от 1 участника, приглашения разрешены) и `TEAM` (enterprise, sales-led). Personal — это первый Workspace, созданный при регистрации; апгрейд до `PRO` происходит **в этом же Workspace** (in place), без второй папки и без переноса ресурсов. Последнего owner удалить нельзя.
2. `WorkspaceMember` — единственное доказательство membership. GitHub Organization не является Doxynix Workspace.
3. Активные member rows, включая owner, занимают места. Email-приглашений в MVP нет: участник добавляется по существующему аккаунту и сразу активен. Когда появятся pending-инвайты, место занимает только принявший — так же устроено в Notion, Vercel, Linear и Slack. `seatLimit` не ограничивает первого owner, но добавление следующего требует доступ и свободное место.
4. Billing mutations требуют `OWNER`; каждый query дополнительно scoped by `workspaceId`, даже при наличии глобального admin.
5. Личный Workspace: `accessState=ACTIVE`, `planCode=HOBBY`, `hasAccess=true`, `seatLimit=1`, без Subscription. Workspace без подписки: `NO_SUBSCRIPTION`, `hasAccess=false`, `seatLimit=0`. Бэкфилла нет — воркспейс создаётся при регистрации.
6. Количество мест всегда равно числу активных membership: добавление и удаление участника меняют `quantity` подписки в той же команде (add → `always_invoice`, remove → `create_prorations`). Отдельного «ручного» изменения мест нет.
7. После `canceled`/`unpaid` Workspace переходит в `planCode=HOBBY`, `seatLimit=0`, доступ выключен; участники и данные сохраняются. Удалить аккаунт нельзя, пока он `OWNER` воркспейса с активной подпиской — сначала передача владения или отмена.
8. Квоты (`analysesPerMonth`, `aiTokensPerMonth`) — часть entitlement и проверяются в коде **до** запуска анализа; Stripe о них не знает. Считаются только свежие анализы: повторный просмотр того же commit SHA из кеша квоту не расходует. Охват репозиториев не ограничиваем: `reposLimit` остаётся `NULL` (без лимита) на всех тарифах. Причина: себестоимость — вычисление на репозиторий, а не количество людей, поэтому seats не могут быть единственной осью.

## 3. Source-of-truth policy

| Область | Источник истины | Локальное представление |
|---|---|---|
| Customer/Subscription status, Price, quantity, Invoice payment, Refund, Dispute | Stripe | Исторические/текущие projections и append-only ledger. |
| Workspace↔Customer/Subscription ownership | Doxynix DB | Создаётся синхронной командой; metadata Stripe для ownership не нужна. |
| Plan catalog mapping, seat rules, feature access, grace, current tenant | Doxynix DB | `WorkspaceEntitlement`, чистая state machine, Workspace configuration. |
| Обработанность Event ID, retry/DLQ, reconciliation findings | Doxynix DB | `BillingEvent`, `BillingIssue`, `BillingReconciliationRun`. |

Stripe — не источник истины о том, кому принадлежит объект: привязка к Workspace находится в нашей БД. БД — не источник истины о деньгах: локальный `status=active`, противоречащий Stripe, не имеет силы.

### Правило расхождения

1. Подписанное событие всегда принимается и сохраняется, даже если переход неизвестен или запрещён локальной state machine.
2. Worker не применяет слепо snapshot `data.object`: он получает текущий объект через Stripe API. Snapshot events допускают дополнительный retrieve для получения актуального объекта ([webhooks](https://docs.stripe.com/webhooks#example-endpoint)); порядок доставки не гарантирован и `created` нельзя использовать для ordering ([event ordering](https://docs.stripe.com/webhooks#event-ordering)).
3. В одной DB transaction обновляются Stripe mirror, entitlement projection, ledger и issue. Remote status хранится как `TEXT`, без PostgreSQL/Prisma enum: новый Stripe status не должен ломать приём.
4. Ожидаемый переход обновляет entitlement. Неожиданный переход тоже обновляет mirror, но ставит `needsReview=true`, создаёт `BillingIssue` и даёт fail-closed `REVIEW` вместо доступа.
5. Webhook worker никогда не «исправляет» Stripe под бизнес-правила. Reconciliation тоже читает Stripe и чинит только БД.
6. Success/cancel URL не выдаёт доступ. Для subscription lifecycle обязательны webhooks ([subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)).

## 4. Data model (таблицы + constraints)

Общее для всех таблиц: локальный `id UUID PK DEFAULT uuidv7()`, `createdAt/updatedAt TIMESTAMPTZ`, FK — `@db.Uuid`; FK indexes создаются явно. Секретные/audit-only FK, которые не должны попадать в DTO, получают `@omit`. Финансовые FK используют `RESTRICT`, не `CASCADE`.

### Tenancy и entitlement

**`workspaces`**
- `name TEXT NOT NULL`, timestamps. Тип не хранится: личный и командный — один и тот же Workspace, различие задаёт план в `workspace_entitlements` (`HOBBY`/`PRO`/`TEAM`).
- Ограничения «один бесплатный Workspace на пользователя» нет: бесплатность определяется планом конкретного воркспейса (`HOBBY` = один участник). Пользователь может состоять в любом числе воркспейсов и владеть несколькими.
- Index: `(createdAt, id)` для административной pagination.
- Владение ресурсами: `Repo.workspaceId`, `GithubInstallation.workspaceId`, api-keys и analysis-артефакты — `NOT NULL` (раздел 20).

**`workspace_members`**
- `workspaceId UUID NOT NULL → workspaces.id CASCADE`, `userId UUID NOT NULL → users.id CASCADE`.
- `role TEXT NOT NULL CHECK (role IN ('OWNER','MEMBER'))`, timestamps.
- `UNIQUE(workspaceId,userId)`, indexes `(userId,workspaceId)`, `(workspaceId,role)`.
- Инвариант «минимум один OWNER» обеспечивается serializable service transaction и integration test; декларативного single-row constraint недостаточно.

**`workspace_entitlements`** — derived projection, не второй источник истины о подписке
- `workspaceId UUID UNIQUE → workspaces.id RESTRICT`.
- `accessState TEXT CHECK (NO_SUBSCRIPTION|PENDING|ACTIVE|GRACE|SUSPENDED|CANCELED|REVIEW)`.
- `planCode TEXT CHECK (HOBBY|PRO|TEAM)`, `seatLimit INT CHECK >=0`, `sourceSubscriptionId UUID NULL`.
- Лимиты и фичи (продуктовая политика, не биллинг): `reposLimit INT NULL` (сейчас `NULL` везде — охват не ограничиваем), `analysesPerMonth INT NULL`, `aiTokensPerMonth INT NULL`, `historyDays INT NULL`; `NULL` = без ограничения.
- Paywall-флаги: `privateReposAllowed BOOLEAN NOT NULL DEFAULT false`, `autoResync BOOLEAN NOT NULL DEFAULT false`, `prReviews BOOLEAN NOT NULL DEFAULT false`.
- `activatedAt`, `graceEndsAt`, `revision BIGINT DEFAULT 0`, timestamps.
- Index `(accessState,graceEndsAt)` для поиска истёкших grace.

### Stripe ownership и commands

**`billing_customers`**
- `workspaceId UUID UNIQUE → workspaces.id RESTRICT`.
- `stripeCustomerId TEXT UNIQUE NOT NULL`, `livemode BOOLEAN NOT NULL`, timestamps.
- Index `(stripeCustomerId,workspaceId)` не нужен отдельно: обе колонки уже уникальны.

**`billing_subscriptions`**
- `workspaceId`, `billingCustomerId`, оба `RESTRICT` и indexed.
- `stripeSubscriptionId TEXT UNIQUE NOT NULL`, `stripeSubscriptionItemId TEXT UNIQUE NOT NULL`.
- `stripePriceId TEXT NOT NULL`, `stripeStatus TEXT NOT NULL`, `quantity INT CHECK >0`, `currency TEXT NOT NULL`.
- `currentPeriodStart/End TIMESTAMPTZ NOT NULL`; в Endive они берутся из `items.data[0].current_period_*` ([Subscription object](https://docs.stripe.com/api/subscriptions/object#subscription_object-items)).
- `cancelAtPeriodEnd BOOLEAN`, `cancelAt TIMESTAMPTZ NULL`, `latestInvoiceId`, `latestInvoiceStatus`.
- `activatedAt`, `pastDueStartedAt`, `graceEndsAt`, `isCurrent`, `needsReview`, `reviewReason`, timestamps.
- Partial unique: `UNIQUE(workspaceId) WHERE isCurrent`; indexes `(billingCustomerId,createdAt)`, `(stripeStatus,currentPeriodEnd)`.
- Неизвестные status/price/currency сохраняются; не делаем CHECK по значениям Stripe.

**`billing_checkout_sessions`**
- `workspaceId`, `stripeCheckoutSessionId TEXT UNIQUE NOT NULL`, `stripeCustomerId TEXT NOT NULL`.
- `stripeStatus TEXT NULL`, timestamps; index `(workspaceId,createdAt)`.
- Эта таблица связывает Session с Workspace без metadata. `checkout.session.*` содержит `customer` и `subscription` IDs ([Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object)).

**`billing_operations`**
- `workspaceId`, nullable `actorUserId SET NULL`, `operation`, `requestId`, `requestHash`, `status`, `stripeObjectId`, sanitized `resultJson`, `errorCode`, timestamps.
- `UNIQUE(workspaceId,requestId)`, index `(status,updatedAt)`.
- Checkout/Portal URL не сохраняются; сохраняется только object ID/безопасный результат.

### Events, ledger и reconciliation

**`billing_events`**
- `stripeEventId TEXT UNIQUE NOT NULL`, `type TEXT NOT NULL`, `livemode BOOLEAN NOT NULL`.
- `apiVersion TEXT NULL`, `stripeCreatedAt TIMESTAMPTZ NOT NULL`.
- `payload JSONB NULL`, `payloadHash TEXT NOT NULL`.
- `status TEXT CHECK (RECEIVED|ENQUEUED|PROCESSING|PROCESSED|DEAD_LETTER)`.
- `attempts INT DEFAULT 0`, `replayCount INT DEFAULT 0`, `lastError TEXT NULL`, `triggerRunId TEXT NULL`.
- `receivedAt`, `processedAt`, timestamps.
- Indexes `(status,receivedAt)`, `(type,stripeCreatedAt)`, `(stripeCreatedAt,id)`.
- `payload` очищается через 90 дней; row и unique `stripeEventId` остаются бессрочно для дедупликации.

**`billing_ledger_entries`** — operational, append-only, не GAAP ledger
- `workspaceId`, nullable `billingEventId`, `entryKey TEXT UNIQUE NOT NULL`.
- `kind`, `stripeObjectId`, `relatedInvoiceId`, `relatedSubscriptionId`, `correctsEntryId NULL`.
- `amount BIGINT NOT NULL` в cents, signed; `currency TEXT NOT NULL`; `occurredAt`, `createdAt`; sanitized `details JSONB`.
- Indexes `(workspaceId,occurredAt,id)`, `(relatedInvoiceId,kind)`, `(stripeObjectId,kind)`.
- ZenStack: create/read только через разрешённые server paths; `@@allow('update,delete', false)` по образцу существующего `WebhookDelivery`. Исправление — новая запись с `correctsEntryId`, не UPDATE.

**`billing_issues`**
- `source`, `kind`, `severity`, `dedupeKey TEXT UNIQUE`, nullable `workspaceId`, `stripeObjectId`.
- `status OPEN|RESOLVED`, sanitized `details JSONB`, `firstSeenAt`, `lastSeenAt`, `resolvedAt`, timestamps.
- Indexes `(status,severity,lastSeenAt)`, `(workspaceId,status)`.

**`billing_reconciliation_runs`**
- `scheduledForDate DATE UNIQUE`, `status RUNNING|SUCCESS|FAILED`.
- `startedAt`, `finishedAt`, counts (`checkedSubscriptions`, `checkedMoneyObjects`, `mismatchCount`), sanitized `error`.

Минимальные ZenStack policies: member читает свой Workspace/entitlement; только owner читает billing projections/ledger своего Workspace; anonymous доступ запрещён; admin имеет служебный read. Webhook/Trigger используют системный `prisma`, не обходя проверку подписи и явные tenant mappings. Все новые таблицы добавляются в `cleanupDatabase()`.

## 5. Subscription state machine

### Remote mirror

Поддерживаем документированные `trialing`, `active`, `incomplete`, `incomplete_expired`, `past_due`, `canceled`, `unpaid`, `paused` ([status definitions](https://docs.stripe.com/billing/subscriptions/overview#subscription-statuses)). Неизвестное будущее значение сохраняется и переводит entitlement в `REVIEW`.

### Local entitlement states

| State | `hasAccess` | Условие |
|---|---:|---|
| `NO_SUBSCRIPTION` | no | Нет current subscription; только team, который ещё не оплатил. Личный HOBBY-воркспейс сюда не попадает — он `ACTIVE`. |
| `PENDING` | no | `incomplete`, либо `active` без первого paid invoice/`activatedAt`. |
| `ACTIVE` | yes | `active` или `trialing` с известным Price и `activatedAt != null`; для `trialing` activation создаётся при входе в trial. Личный HOBBY-воркспейс: `ACTIVE` без Subscription. |
| `GRACE` | yes | `past_due`, ранее активированная подписка и `now < graceEndsAt`. |
| `SUSPENDED` | no | `unpaid`, `paused`, истёкший grace либо `past_due` без прежней активации. |
| `CANCELED` | no | `canceled` или `incomplete_expired`. |
| `REVIEW` | no | Неизвестный status/price, multiple items, неожиданный переход, remote object not found. |

`activatedAt` предотвращает доступ при initial asynchronous payment: `active` сам по себе не всегда означает отсутствие outstanding invoices ([Subscription statuses](https://docs.stripe.com/billing/subscriptions/overview#subscription-statuses)). На renewal после первой активации temporary unpaid latest invoice обрабатывается через `past_due/grace`, а не сбросом активации.

### Допустимые переходы доступа

- `NO_SUBSCRIPTION → PENDING|ACTIVE`.
- `PENDING → ACTIVE|CANCELED|SUSPENDED|REVIEW`.
- `ACTIVE → GRACE|SUSPENDED|CANCELED|REVIEW`.
- `GRACE → ACTIVE|SUSPENDED|CANCELED|REVIEW`.
- `SUSPENDED → ACTIVE|CANCELED|REVIEW`.
- `CANCELED → PENDING|ACTIVE` только при **новом** `stripeSubscriptionId`; оживление canceled ID = `REVIEW`.
- Одинаковое состояние и `* → REVIEW` допустимы. Из `REVIEW` выход только после нового canonical read с валидной конфигурацией; issue закрывается отдельно.

### Что двигает состояние

| Event | Действие worker |
|---|---|
| `checkout.session.completed`, `.async_payment_succeeded`, `.async_payment_failed` | Bind Session→Workspace; retrieve связанные объекты; сам по себе доступ не выдаёт. Типы событий: [Event types](https://docs.stripe.com/api/events/types). |
| `customer.subscription.created`, `.updated`, `.deleted`, `.paused`, `.resumed` | Retrieve current Subscription + latest Invoice; upsert mirror; recompute entitlement ([subscription events](https://docs.stripe.com/billing/subscriptions/webhooks#subscription-events)). |
| `invoice.paid` | Resolve Subscription, append `INVOICE_PAID`, установить first `activatedAt`, затем retrieve Subscription и recompute ([invoice.paid](https://docs.stripe.com/billing/subscriptions/webhooks#invoice-events)). |
| `invoice.payment_failed` | Сохранить первый `pastDueStartedAt` по `event.created`, один раз выставить `graceEndsAt=+7d`, затем canonical sync ([payment failure](https://docs.stripe.com/billing/subscriptions/webhooks#invoice-events)). |
| `invoice.finalization_failed` | Создать critical issue и tax/location action; не подделывать paid/canceled status ([finalization failure](https://docs.stripe.com/billing/subscriptions/webhooks#webhook-endpoints-and-invoices)). |
| `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed` | Canonical refund/charge resolution и ledger; entitlement не меняется ([refund events](https://docs.stripe.com/refunds#refund-events)). |
| `charge.dispute.created`, `.updated`, `.closed` | Ledger + issue; entitlement не меняется автоматически ([dispute API](https://docs.stripe.com/disputes/api)). |
| `radar.early_fraud_warning.created` | Critical issue; нет автоматического блока/cancel ([risk events](https://docs.stripe.com/billing/subscriptions/webhooks#handle-risk-and-customer-data-events)). |

Повторный `invoice.payment_failed` не продлевает grace. При `invoice.paid` grace очищается только если canonical Subscription действительно вернулся в `active`; оплата старой Invoice не должна перекрыть более новый failure.

## 6. Webhook contract

Endpoint: `POST /api/webhooks/stripe`, Node Route Handler, вне `[locale]`.

1. `await request.text()`; никаких `request.json()`/transform до verification. Raw body требуется для подписи ([raw body requirement](https://docs.stripe.com/webhooks#verify-events)).
2. Читаем `Stripe-Signature`; `stripe.webhooks.constructEvent(rawBody,signature,STRIPE_WEBHOOK_SECRET)` с default tolerance, не `0`. Node-формат метода дан в [official webhook example](https://docs.stripe.com/webhooks#verify-signature), default tolerance 5 минут — [timestamp tolerance](https://docs.stripe.com/webhooks#verify-signatures-manually).
3. Используем v1 snapshot Events и отдельный endpoint с API version `2026-09-30.endive`. Webhook payload version задаётся endpoint/account settings, поэтому Dashboard configuration входит в deploy checklist ([versioning](https://docs.stripe.com/api/versioning)).
4. Проверяем `livemode` против окружения и minimal envelope. Неподдерживаемый тип — `200 {ignored:true}`, без обработки. Endpoint подписан только на перечисленные в разделе 5 события: Stripe рекомендует слушать только необходимые типы ([event selection](https://docs.stripe.com/webhooks#best-practices-for-using-webhooks)).
5. В одной короткой DB operation создаём `BillingEvent(RECEIVED)` с SHA-256 raw body. Unique violation = duplicate. Если тот же Event ID имеет другой hash — security issue, payload не перезаписываем.
6. Для нового или ранее не enqueue события вызываем `tasks.trigger<typeof processStripeEventTask>("billing-process-stripe-event",{billingEventId},{idempotencyKey:event.id,concurrencyKey:ownershipKey})`, type-only task import. Затем `ENQUEUED` + `triggerRunId`. Trigger key TTL по умолчанию 30 дней, поэтому долговременной гарантией остаётся DB unique, а не очередь (локальная Trigger 4.8.1 docs `triggering.mdx#idempotencykey`).
7. Только после durable event + enqueue возвращаем `200`. Stripe требует быстрый 2xx до сложной работы ([quick 2xx](https://docs.stripe.com/webhooks#quickly-return-a-2xx-response)).

HTTP:

- `200`: processed/enqueued, duplicate, unsupported signed event.
- `400`: missing/bad signature, malformed signed payload; нет retry-полезной работы.
- `500/503`: DB или Trigger unavailable. Stripe в live mode повторяет доставку до трёх дней с exponential backoff ([automatic retries](https://docs.stripe.com/webhooks#automatic-retries)).
- Duplicate в `RECEIVED/DEAD_LETTER` не short-circuit навсегда: route повторяет enqueue с тем же `event.id`; `PROCESSED` сразу `200`.

Worker: 8 attempts, exponential backoff+jitter; transient network/429/5xx retry. Schema/ownership/version mismatch — non-retryable DLQ. `onFailure` после исчерпания retries помечает `DEAD_LETTER`, создаёт critical issue; для Crashed/System failure дополнительный scheduled sweeper находит зависшие `PROCESSING` (Trigger local docs предупреждает, что `onFailure` срабатывает не для всех статусов).

Event ordering решается canonical retrieve + per-owner concurrency. `event.created` — только audit timestamp. Два разных Event IDs для одного object transition могут существовать; дополнительная идемпотентность — deterministic ledger keys и canonical upsert ([duplicate guidance](https://docs.stripe.com/webhooks#handle-duplicate-events)).

Replay: admin создаёт новый run из сохраненного payload с key `${event.id}:replay:${replayCount+1}`. Оригинальная доставка всегда использует ровно `event.id`; suffix нужен только для сознательного нового запуска после DLQ. Все side effects остаются идемпотентными по natural keys.

## 7. Idempotency

| Вызов | Key | Конфликт/повтор |
|---|---|---|
| Trigger event task | `event.id` | DB unique — вечная дедупликация; Trigger dedup — до TTL. |
| Create Customer | `doxynix:{env}:customer:{workspaceId}:{requestId}` | Тот же key+params возвращает saved response; локально upsert mapping. |
| Create Checkout Session | `...:checkout:{workspaceId}:{requestId}` | Повтор команды не создаёт вторую Session. |
| Update Subscription price/quantity | `...:subscription:{workspaceId}:{requestId}` | Повтор не меняет дважды; сохраняем Subscription ID. |
| Create Portal Session | Случайный request ID на каждое намеренное открытие | Safe retry одного HTTP запроса; новый клик = новый request ID. URL не сохраняем. |
| Ledger | `kind:{stripeObjectId}:{status/sequence}` | Unique `entryKey`; повторный event = no-op. |
| Reconciliation run | `scheduledForDate` unique + `reconcile:{date}` | Повтор schedule не создаёт параллельный run. |

Все POST к Stripe v1 принимают idempotency keys; GET/DELETE не получают их ([idempotent requests](https://docs.stripe.com/api/idempotent_requests)). Ключи ≤255 chars, без email/PII.

Клиент передаёт UUID `requestId`. Server сохраняет canonical-body SHA-256. Совпадение `(workspaceId,requestId,requestHash)` возобновляет/возвращает результат; тот же requestId с другим телом — `409 BILLING_IDEMPOTENCY_CONFLICT`. Локальный operation record живёт дольше 24 часов, поэтому старый client retry не создаёт новую операцию после возможного pruning Stripe key. Документированное сравнение параметров и pruning описаны в [idempotent requests](https://docs.stripe.com/api/idempotent_requests).

Multi-call command не претендует на распределённую транзакцию: crash после Customer create повторяет Customer create с тем же key, затем продолжает Checkout. Crash после Stripe response до local write восстанавливается по object ID/key; reconciliation ловит остаточные случаи.

## 8. Entitlements

Единственная функция:

```text
getWorkspaceEntitlement(workspaceId, now) = {
  hasAccess, accessState, planCode, seatLimit,
  reposLimit, analysesPerMonth, aiTokensPerMonth, historyDays,
  privateReposAllowed, autoResync, prReviews,
  graceEndsAt, revision
}
```

- Читает только `WorkspaceEntitlement` и membership; Stripe API в request path запрещён.
- `hasAccess = accessState ∈ {ACTIVE,GRACE} && knownPlan && now < optionalAccessDeadline`. Для личного воркспейса `planCode=HOBBY` считается известным планом, а `accessState=ACTIVE` выставляется при регистрации — отдельной ветки в формуле нет.
- `seatLimit = quantity` текущей Subscription, даже при отключённом доступе; добавление member проверяет и `hasAccess`, и `activeMembers < seatLimit`.
- `privateReposAllowed` / `autoResync` / `prReviews` / `historyDays` читаются из той же projection и проверяются в коде до соответствующей операции; `reposLimit` сейчас `NULL` везде — охват публичных репозиториев не ограничивается.
- Квоты `analysesPerMonth` / `aiTokensPerMonth` читаются из той же projection и проверяются в коде до старта анализа. Квота расходуется только свежим анализом: повторный просмотр того же commit SHA из кеша её не тратит. Превышение — `403 LIMIT_EXCEEDED` на свежий анализ, Stripe не участвует.
- `cancelAtPeriodEnd=true` не отключает доступ до фактического `canceled`: cancellation event/state описаны в [cancel subscriptions](https://docs.stripe.com/billing/subscriptions/cancel).
- При `past_due`: до `graceEndsAt` сохраняются текущий plan и seats; после — `SUSPENDED`. Не повышаем plan/seats во время `past_due`, `unpaid`, `incomplete`, `REVIEW`.
- При `unpaid` доступ отключается немедленно; Stripe также рекомендует revoke для unpaid ([statuses](https://docs.stripe.com/billing/subscriptions/overview#subscription-statuses)).

**Кеш:** только memoization Promise в пределах одного tRPC request. Redis/cross-request cache на старте нет, поэтому отзыв доступа виден сразу после commit и не зависит от TTL. Индекс `workspace_entitlements.workspaceId` делает read O(1); distributed cache добавляется только после measured need.

Generic `server/core/entitlements.ts` читает projection и предоставляет middleware; он не импортирует `billing`. `billing` лишь обновляет projection. Так соблюдается downward-only graph, а `repo/analysis` не импортируют billing internals.

## 9. Plan changes & proration

Выбраны **immediate changes без Subscription Schedules**: это убирает отдельную scheduled state machine; monthly interval не меняется.

1. Операции доступны только OWNER и только при remote `active`, известном catalog, одном SubscriptionItem. `past_due/unpaid/incomplete` — `409 BILLING_NOT_CHANGEABLE`.
2. Сначала `invoices.createPreview` с Subscription ID и `subscription_details.items`; preview не изменяет Subscription ([proration preview](https://docs.stripe.com/billing/subscriptions/prorations#preview-proration)). Клиент затем подтверждает точный requestId/body.
3. При смене Price обязательно передаём существующий `items[0].id` и текущий `quantity`: без item ID Stripe добавляет item, а price update может вернуть quantity к 1 ([change price](https://docs.stripe.com/billing/subscriptions/change-price#update-the-subscription)).
4. **Upgrade / увеличение seats:** immediate, `proration_behavior:'always_invoice'`; Stripe рассчитывает prorations и сразу создаёт Invoice ([control proration](https://docs.stripe.com/billing/subscriptions/prorations#create-immediate-prorations)). API response не выдаёт новый entitlement — ждём canonical webhook sync.
5. **Downgrade / уменьшение seats:** immediate, `proration_behavior:'create_prorations'`; credit идёт в billing flow, не cash refund. Negative prorations не возвращаются автоматически ([proration behavior](https://docs.stripe.com/billing/subscriptions/prorations#how-prorations-work)). Запрещено, если новый quantity меньше active member count.
6. Checkout создаёт Subscription с `subscription_data.billing_mode.type='classic'`, чтобы поведение proration/cancellation не зависело от account default; supported values/default задокументированы в [Checkout create](https://docs.stripe.com/api/checkout/sessions/create#create_checkout_session-subscription_data-billing_mode).
7. При unpaid current-period invoice plan changes блокируются, чтобы не кредитовать неоплаченное время; предупреждение и возможные последствия описаны в [prorations and unpaid invoices](https://docs.stripe.com/billing/subscriptions/prorations#prorations-and-unpaid-invoices).
8. Portal настроен только на payment method, invoices, tax IDs и cancellation; plan/quantity update выключен. Portal поддерживает разделение этих возможностей конфигурацией ([portal configuration](https://docs.stripe.com/customer-management/integrate-customer-portal#configure)).

Failed immediate payment может оставить Subscription `past_due` даже при успешном update response ([immediate payment](https://docs.stripe.com/billing/subscriptions/change-price#immediate-payment)); поэтому command не считается финансово успешным до `invoice.paid`, а доступ контролируется grace policy.

## 10. Dunning

- **Владелец retries:** Stripe Smart Retries, configured **8 tries within 2 weeks**. Документированный recommended default — 8/2 weeks; конкретное время выбирает Smart Retries, поэтому код не содержит cron повторных платежей ([Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries)).
- **Владелец писем:** Stripe. Включаем “Send emails when card payments fail”; Stripe отправляет email после каждого failed payment и ссылку для обновления payment method ([customer emails](https://docs.stripe.com/billing/revenue-recovery/customer-emails#failed-payment-notifications)). Doxynix не создает 12-локальные dunning templates.
- **Наблюдение:** `invoice.payment_failed`, `attempt_count`, `next_payment_attempt`; оба поля задокументированы в [Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries#invoice-payment-failed-webhook).
- **Grace:** 7 календарных дней от первого failed renewal. Повторные failures не продлевают. Initial payment grace не даёт доступ.
- **После grace:** локальный `SUSPENDED`, даже если Stripe ещё retry. После final attempt Dashboard настроен на **cancel subscription**; возможные исходы canceled/unpaid/past_due описаны в [retry settings](https://docs.stripe.com/billing/revenue-recovery/smart-retries#after-the-final-payment-attempt).
- **Recovery:** paid invoice + canonical `active` восстанавливает доступ и очищает grace. `unpaid`, `canceled`, `incomplete_expired` отключают сразу. После canceled создаётся новая Checkout Subscription; попытка обновить terminal subscription не используется ([statuses](https://docs.stripe.com/billing/subscriptions/overview#subscription-statuses)).

## 11. Tax

Порядок обязателен:

1. Tax Settings: подтверждён head office address и `status=active`; без этого Tax не рассчитывается ([Tax setup](https://docs.stripe.com/tax/set-up)).
2. Налоговый консультант подтверждает юрисдикции и Product Tax Code из canonical list. Код не выдумываем: [Tax Codes API](https://docs.stripe.com/api/tax_codes), [digital products](https://docs.stripe.com/tax/digital-products). Price `tax_behavior` задаётся в catalog configuration.
3. Бизнес регистрируется у налогового органа; затем registration добавляется в Stripe. Stripe registration отражает уже существующую регистрацию, а не создаёт её ([registering](https://docs.stripe.com/tax/registering)).
4. Проверяем `GET /v1/tax/registrations?status=active` для каждой обязательной launch jurisdiction ([List registrations](https://docs.stripe.com/api/tax/registrations/list)).
5. Только затем Checkout создаётся с `automatic_tax.enabled=true`, `billing_address_collection='required'`, `customer_update.address='auto'`, `tax_id_collection={enabled:true,required:'never'}` ([Checkout create](https://docs.stripe.com/api/checkout/sessions/create)).
6. Для США сохраняем полный billing address в Stripe; локально адрес/tax ID не дублируем. Customer location hierarchy и US precision описаны в [customer locations](https://docs.stripe.com/tax/customer-locations).

B2B tax ID собирается в Checkout/Portal, но сам по себе не трактуется кодом как US exemption или reverse charge. Освобождения/сертификаты — ручной налоговый процесс, не автоматический entitlement.

**Если нет active registration:** production paid launch блокируется. `automatic_tax` без registration не возвращает ошибку и не собирает налог в такой юрисдикции ([collect taxes](https://docs.stripe.com/billing/taxes/collect-taxes?tax-calculation=stripe-tax)); поэтому нельзя считать сам флаг защитой. Код не добавляет registration и не переключается молча на manual rates. Нулевой налог/`not_collecting` создаёт critical issue; sandbox diagnosis проверяет tax code и registration.

`invoice.finalization_failed` с `automatic_tax.status=requires_location_inputs` означает invalid/insufficient address; Invoice не finalize и payment не collect ([finalization failures](https://docs.stripe.com/tax/customer-locations#finalizing-invoices-with-finalization-failures)). Billing status получает `needsAction=TAX_LOCATION`, critical alert уходит операторам, доступ остаётся по текущему billing state до последующего canonical transition.

## 12. Refunds & disputes

### Resolution для Endive

Для `charge.refunded`, Dispute и EarlyFraudWarning используем object graph, не metadata:

1. Берём `payment_intent` с объекта; если null, retrieve Charge и берём его `payment_intent`.
2. Вызываем List Invoice Payments с `payment.type=payment_intent`, PaymentIntent ID и `status=paid`.
3. Пагинируем все InvoicePayments: один PaymentIntent может относиться к нескольким Invoices.
4. Retrieve каждую Invoice; принимаем только `parent.type=subscription_details`, затем `parent.subscription_details.subscription`.

Это дословно version-specific flow для API `2025-03-31.basil` и новее ([refund/dispute resolution](https://docs.stripe.com/billing/subscriptions/webhooks#handle-refund-dispute-and-early-fraud-warning-events)). `Charge.invoice` из старых примеров в Endive не используем.

### Отражение

- `INVOICE_PAID`: `+amount_paid` с Invoice ID ([Invoice object](https://docs.stripe.com/api/invoices/object)).
- `REFUND_SUCCEEDED`: отдельная negative entry по каждому Refund ID; Refund имеет `amount`, `charge`, `payment_intent`, `status` ([Refund object](https://docs.stripe.com/api/refunds/object)).
- `REFUND_FAILED/CANCELED`: новая operational entry, не удаление прежней. Failed/cancelled refund не означает завершённый возврат клиенту ([failed refunds](https://docs.stripe.com/refunds#handle-failed-refunds)).
- `DISPUTE_OPENED`: negative operational entry + critical issue. `DISPUTE_WON/LOST`: отдельная entry по Dispute ID/status; `amount`, `charge`, `payment_intent`, `status` подтверждены [Dispute object](https://docs.stripe.com/api/disputes/object).
- Taxed invoice refund/credit note: Stripe Tax корректирует liability; приложение не рассчитывает собственную tax reversal ([Tax refunds](https://docs.stripe.com/tax/invoicing/refunds)).

**Не откатывается автоматически:** Subscription cancellation, entitlement/seat revocation, удаление members, стирание paid ledger, изменение исторических entries, ручная financial decision по fraud, повторная выдача доступа после dispute won. Refund/dispute — money events, не доказательство желаемого cancellation. Support принимает решение в Dashboard; отдельная admin cancellation проходит обычную state machine.

## 13. Reconciliation

Nightly `schedules.task`, `17 4 * * *` UTC, unique date, distributed overlap запрещён unique run. Отдельный sweeper каждые 15 минут обрабатывает зависшие `RECEIVED/PROCESSING` и пропущенный enqueue.

Алгоритм:

1. Загрузить все Subscriptions со `status=all`, полной cursor pagination (`starting_after`, `has_more`) ([List subscriptions](https://docs.stripe.com/api/subscriptions/list)).
2. Сверить по `stripeSubscriptionId`: Workspace mapping, Customer, status, one item, Price, quantity, currency, period, cancellation flags. `status=all` включает все состояния ([List subscriptions](https://docs.stripe.com/api/subscriptions/list)).
3. Для каждого локального current Subscription отсутствующего в list сделать direct retrieve, чтобы отличить filtering/pagination error.
4. Для локальных Invoice/Refund/Dispute IDs за 90 дней выполнить canonical retrieve и сверить ledger natural keys/amount/currency/status. Unknown object связывается только через уже подтверждённый Customer/Invoice graph; никаких metadata guesses.
5. Проверить очередь событий, active tax registrations и последний successful run.
6. Сохранить run/issues; alert по severity. Reconciliation никогда не делает Stripe writes.

| Расхождение | Действие |
|---|---|
| Mirror отличается от canonical Subscription | Canonical upsert + recompute + invalidate ничего не требуется, т.к. нет distributed cache; auto-resolved issue. |
| Subscription есть в Stripe, Customer известен, локальной row нет | Создать historical mirror; current менять только по one-current rule; recompute. |
| Customer/Subscription не связан с Workspace | Critical `UNOWNED_STRIPE_OBJECT`, no access, manual binding; не угадывать tenant. |
| Local current отсутствует в Stripe | `needsReview`, `REVIEW` no access, critical alert; row не удалять. |
| Ledger missing entry | Append canonical entry с deterministic key. |
| Ledger amount/status конфликтует | Append correction delta/reference; старую запись не менять. |
| Неожиданный переход | Сохранить mirror, `REVIEW`, alert; не откатывать Stripe. |
| Нет successful run >26h или DLQ существует | Critical operational alert. |

## 14. Test strategy

### Unit (без сети)

- Табличные tests всех remote statuses и всех local transitions; `now == graceEndsAt` = no access; repeated failure не продлевает grace; canceled→active same ID = mirror accepted + REVIEW.
- Checkout params: `mode='subscription'`, один Price/quantity, tax flags, classic billing mode, отсутствие `payment_method_types`; success page не активирует.
- Subscription update: item ID + quantity сохраняются; upgrade=`always_invoice`, downgrade=`create_prorations`; downgrade ниже members отклонён до Stripe call.
- Idempotency: same key/body = один Stripe call; same key/different body = 409; crash после Customer create возобновляется тем же key.
- Webhook: raw body valid signature, bad signature, missing header, changed byte после подписи, expired timestamp, duplicate, concurrent duplicate, queue failure, malformed event.
- Out-of-order: paid→created, deleted→updated, старый failure после нового paid. Mock canonical read определяет итог, не timestamp.
- Risk resolver: null PaymentIntent, multiple InvoicePayments, non-subscription Invoice, unresolved owner, refund failure, dispute won/lost.

### Записанные fixtures

- Sanitized raw Events из отдельного sandbox, API version Endive: `subscription-created`, `invoice-paid`, `invoice-payment-failed`, `charge-refunded`, `dispute-created`, `out-of-order-*`.
- Fixture хранит raw JSON + metadata о типе/version; секреты/address/email/tax IDs удалены. Подпись для test генерируется заново на test secret, поэтому sanitized payload не требует настоящей Stripe signature.
- Stripe CLI-triggered fake events не используются как proof object correlation: документация предупреждает, что они не соотносятся с реальными объектами ([test webhook notifications](https://docs.stripe.com/billing/testing/test-clocks#test-subscription-webhook-notifications)).

### Integration (disposable Postgres)

- Unique Event ID под concurrency; one current Subscription per Workspace; foreign keys/policies; owner vs member vs anonymous; ledger update/delete denied.
- Crash между mirror и projection оставляет transaction rolled back; replay после DLQ не дублирует ledger.
- Personal воркспейс создаётся при регистрации (бэкфилла нет); last owner и seat invariants держатся под concurrency.
- Reconciliation missing/extra/mismatch/unknown tenant/correction entry.

### Sandbox + test clocks (opt-in, не default CI)

- Отдельные sandboxes для local и CI; sandbox изолирует settings/data ([sandboxes](https://docs.stripe.com/sandboxes)).
- Test Clock привязывается к Customer при создании; Subscription наследует clock ([advanced test clocks](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage)). Advance не более двух интервалов за раз ([advance time](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage#advance-the-simulated-time)).
- Scenarios: initial sync/async pay, renewal, failed renewal→8 retries→cancel, recovery, upgrade/downgrade, quantity, cancellation, refund/dispute/fraud actions, tax registration/address.
- Ожидание — poll локального processed event/reconciliation с timeout, не fixed sleep. Grace boundary проверяется fake time локально; двухнедельный dunning — test clock.
- Sandbox external suite не запускается в `bun run test`; секреты берутся из отдельного Doppler config.

## 15. Observability

Structured logs содержат только `requestId`, Workspace ID, Event ID/type, Trigger run ID, attempt, Stripe object ID, duration, mismatch kind. Никаких raw payload, keys, email, address, tax ID, card data.

Метрики/structured counters:

- `billing_webhook_received_total{type,result}`, `billing_webhook_lag_seconds`, `billing_event_failures_total{type,errorClass}`.
- `billing_event_oldest_unprocessed_seconds`, `billing_dlq_total`, `billing_replay_total`.
- `billing_subscription_transition_total{from,to,expected}`, `billing_entitlement_total{state}`.
- `billing_checkout_started/completed_total`, `billing_proration_total{kind,result}` (без amount в analytics).
- `billing_dunning_started/recovered/suspended_total`.
- `billing_reconciliation_duration_seconds`, `billing_reconciliation_mismatches_total{kind}`, `billing_reconciliation_last_success_timestamp`.
- `billing_refund_total`, `billing_dispute_total{status}`, `billing_tax_issue_total{kind}`.

Sentry alerts: любой DLQ, invalid signature hash reuse, invalid transition, unowned object, dispute/fraud, missing required tax registration, reconciliation failure. Warning thresholds: >5% webhook failures за 5 минут, oldest unprocessed >2 минуты, нет successful reconciliation >26 часов. PostHog используется только для product metrics, не как paging. Trigger logs связываются по run ID; финансовые расхождения видны в `BillingIssue` до ручного resolve.

## 16. DoD rubric — 10 пунктов

Ответы отражают **текущий greenfield baseline**, а не желаемый результат. При сдаче каждый ответ обязан стать `yes`; внешние проверки без доступа остаются `cannot-verify`, и запуск не считается завершённым.

| # | Проверка | Ответ |
|---|---|---|
| 1 | Есть Workspace/Membership, owner-only billing и проверенные seat invariants? | no |
| 2 | Все billing таблицы/constraints/indexes мигрированы, Event ID unique, ledger update/delete запрещены? | no |
| 3 | Checkout/Portal работают в отдельном sandbox без `payment_method_types`, с pinned Endive и RAK? | no |
| 4 | Raw-signature webhook, durable enqueue, duplicate/out-of-order/retry/DLQ tests проходят? | no |
| 5 | State machine принимает любые remote statuses, но fail-closed при anomaly; grace/recovery проверены? | no |
| 6 | Entitlement не ходит в Stripe на request path, отдаёт лимиты (seats/repos/analyses/tokens) и не имеет distributed-cache staleness? | no |
| 7 | Upgrade/downgrade/quantity/proration и idempotency conflicts покрыты unit+sandbox tests? | no |
| 8 | Refund/dispute/fraud, tax finalization и nightly reconciliation создают ledger/issues без нежелательных automatic rollbacks? | no |
| 9 | Test clocks, failure injection, integration suite и `bun run validate` зелёные? | no |
| 10 | В live account подтверждены Tax Settings, все обязательные registrations, tax code, Smart Retries, emails и portal configuration? | cannot-verify |

## 17. Task list

**File structure:** `workspaces` владеет tenant/membership; `billing` владеет Stripe, events, ledger и projection writes; `server/core/entitlements.ts` только читает generic projection. Webhook Route Handler тонкий; вся доменная работа в `billing`. Ни один файл не превращается в combined router+service+Stripe client.

### Foundation

> Foundation вынесен в обязательный предшествующий эпик — **раздел 20, задачи WS-01…WS-06**. Биллинг начинается с BILL-03 и запускается только когда WS-01…WS-04 зелёные. Нумерация BILL сохранена, чтобы не ломать ссылки.

### Billing core

- [x] **BILL-03 — Billing schema и ledger constraints (1 день)**
  - **Files touched:** Create `apps/web/prisma/models/billing.zmodel`; Modify `apps/web/prisma/schema.zmodel`, `apps/web/src/tests/helpers.ts`; Create `apps/web/src/tests/integration/billing-schema.test.ts`, новую Prisma migration.
  - **Acceptance criteria:** Все `billing_*` таблицы раздела 4 (workspace-таблицы приходят из WS-01) включая partial unique current subscription и permanent unique Event ID; unknown Stripe status вставляется; ledger update/delete denied; payload purge не удаляет Event ID.
  - **Проверка:** `bun --filter @doxynix/web db:generate && (cd apps/web && bun prisma migrate dev --name add_billing) && bun --filter @doxynix/web db:push:test && bun --filter @doxynix/web test:int src/tests/integration/billing-schema.test.ts`

- [ ] **BILL-04 — Stripe SDK, secrets, catalog и version pin (0.5 дня)**
  - **Files touched:** Modify `apps/web/package.json`, `bun.lock`, `apps/web/src/shared/config/env.server.ts`, `apps/web/src/tests/setup-env.ts`, `apps/web/.env.example`; Create `apps/web/src/server/modules/billing/billing.stripe.ts`, `billing.catalog.ts`, `billing.catalog.test.ts`.
  - **Acceptance criteria:** Instance-based Stripe client, Endive в code и runbook; `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY_USD`, `STRIPE_LIVEMODE`, tax jurisdictions через Doppler; test env не требует live values; unknown Price/interval/currency отклоняется; no API keys в репозитории.
  - **Проверка:** `bun --filter @doxynix/web add stripe && bun run clean:symlinks && bun --filter @doxynix/web test src/server/modules/billing/billing.catalog.test.ts && bun --filter @doxynix/web type-check`

- [ ] **BILL-05 — Local command idempotency (0.5 дня)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/billing.operations.ts`, `billing.operations.test.ts`, `billing.schemas.ts`.
  - **Acceptance criteria:** UUID requestId + canonical hash; same operation resume/result, conflicting body 409; sanitized result без URL/PII; Stripe key ≤255 и не содержит email; concurrent same request создаёт одну operation.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.operations.test.ts`

- [ ] **BILL-06 — Customer и hosted Checkout (1 день)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/billing.checkout.ts`, `billing.checkout.test.ts`, `billing.router.ts`; Modify `apps/web/src/server/modules/index.ts`.
  - **Acceptance criteria:** Owner-only `createCheckout`; Customer create и Session create идемпотентны; Session persistently связана с Workspace без metadata; `mode=subscription`, quantity=members, automatic tax/tax ID/full address/classic, dynamic PM, no trial; success return не меняет entitlement.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.checkout.test.ts && bun --filter @doxynix/web type-check`

### Events и entitlements

- [ ] **BILL-07 — Raw webhook intake и durable enqueue (1 день)**
  - **Files touched:** Create `apps/web/src/app/api/webhooks/stripe/route.ts`, `apps/web/src/server/modules/billing/billing.webhook.ts`, `billing.webhook.test.ts`, `tasks/process-stripe-event.task.ts`; Modify `apps/web/src/server/utils/task-config.ts`.
  - **Acceptance criteria:** Raw verify до parse; correct HTTP matrix; unique Event ID+payload hash; type-only task import; exact `idempotencyKey=event.id`; failed enqueue даёт non-2xx и повторяется на retry; route не вызывает Stripe retrieve/domain projection.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.webhook.test.ts`

- [ ] **BILL-08 — Canonical worker, retry и DLQ (1 день)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/billing.events.ts`, `billing.resolver.ts`, `billing.events.test.ts`, `billing.issues.ts`; Modify `apps/web/src/server/modules/billing/tasks/process-stripe-event.task.ts`, `apps/web/src/server/utils/task-config.ts`; Create `apps/web/src/server/modules/billing/tasks/sweep-stripe-events.task.ts`.
  - **Acceptance criteria:** Worker canonical retrieve; per-owner serialization; non-retryable version/owner/schema errors; 8 attempts; final `onFailure` DLQ; 15-minute sweeper зависших runs; никакой Stripe write из worker.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.events.test.ts`

- [ ] **BILL-09 — Subscription projection и state machine (1 день)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/billing.state.ts`, `billing.state.test.ts`, `billing.subscriptions.ts`, `billing.subscriptions.test.ts`; Modify `apps/web/src/server/modules/billing/billing.events.ts`.
  - **Acceptance criteria:** Все statuses/переходы раздела 5; current-period берётся из item; one-current сохраняет историю; initial active без paid не даёт доступ; canceled→active сохраняет mirror+REVIEW; projection transaction atomically обновляет entitlement.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.state.test.ts src/server/modules/billing/billing.subscriptions.test.ts`

- [ ] **BILL-10A — Usage metering: события, роллап, reserve/settle (1–2 дня)**
  - **Files touched:** Modify `apps/web/prisma/models/billing.zmodel` (таблицы `usage_events`, `workspace_usage`), `apps/web/prisma/models/review.zmodel` (поля учёта в `Analysis`); Create `apps/web/src/server/modules/billing/billing.usage.ts`, `billing.price.ts`, `billing.usage.test.ts`, `billing.price.test.ts`; Create `apps/web/src/tests/integration/billing-usage.test.ts`.
  - **Acceptance criteria:** `usage_events` — append-only, `idempotencyKey` unique, хранит provider/model и классы токенов (`input`, `cachedInput`, `output`) + `costCents`; `workspace_usage` — `UNIQUE(workspaceId, periodStart)`, поля `analysesCount`, `aiTokensUsed`, `costCents`; стоимость считается **только** из прайс-таблицы в коде (`priceFor(model, class)` с датой вступления), не из счёта вендора; reserve→call→settle: до вызова резервируется оценка, после — списывается факт, разница освобождается; повторный `usage_event` с тем же ключом не увеличивает счётчики; повторный анализ того же `commit SHA` из кеша пишет событие с нулевой стоимостью и **не** расходует квоту; `402/403` при исчерпании квоты против `429` при превышении скорости — разные коды.
  - **Проверка:** `bun --filter @doxynix/web db:generate && (cd apps/web && bun prisma migrate dev --name add_usage_metering) && bun --filter @doxynix/web test src/server/modules/billing/billing.price.test.ts src/server/modules/billing/billing.usage.test.ts && bun --filter @doxynix/web test:int src/tests/integration/billing-usage.test.ts`

- [ ] **BILL-10 — Generic entitlement reader/middleware (1 день)**
  - **Files touched:** Create `apps/web/src/server/core/entitlements.ts`, `apps/web/src/server/core/entitlements.test.ts`; Modify `apps/web/src/server/core/trpc/init.ts`; Create `apps/web/src/tests/integration/entitlements.test.ts`.
  - **Acceptance criteria:** DB-only read, request memoization, no Redis; owner/member scoping; ACTIVE/GRACE allow, все остальные deny; лимиты (`seatLimit`, `reposLimit`, `analysesPerMonth`, `aiTokensPerMonth`) отдаются тем же reader'ом, превышение → `403 LIMIT_EXCEEDED` до старта работы; источником израсходованного служит `workspace_usage` (BILL-10A), а не подсчёт `Analysis` в цикле; core не импортирует modules; seat check атомарен с membership mutation.
  - **Проверка:** `bun --filter @doxynix/web test src/server/core/entitlements.test.ts && bun --filter @doxynix/web test:int src/tests/integration/entitlements.test.ts && bun --filter @doxynix/web arch:check`

- [ ] **BILL-11 — Invoice payment, dunning и ledger (1 день)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/billing.invoices.ts`, `billing.invoices.test.ts`, `billing.ledger.ts`, `billing.ledger.test.ts`; Modify `apps/web/src/server/modules/billing/billing.events.ts`, `apps/web/src/server/modules/system/tasks/cleanup-db.task.ts`.
  - **Acceptance criteria:** Paid активирует один раз и пишет ledger; first failure задаёт 7d; duplicates не продлевают/не дублируют; recovery canonical active очищает grace; unpaid/expired deny; payload purge через 90 дней сохраняет Event ID.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.invoices.test.ts src/server/modules/billing/billing.ledger.test.ts`

### Customer actions и риски

- [ ] **BILL-12 — Preview, plan и seat changes (1 день)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/billing.plan-changes.ts`, `billing.plan-changes.test.ts`; Modify `apps/web/src/server/modules/billing/billing.router.ts`, `apps/web/src/server/modules/billing/billing.schemas.ts`, `apps/web/src/server/modules/workspaces/workspace.service.ts`.
  - **Acceptance criteria:** Preview не mutates; exact proration matrix; item ID+quantity; member-count guard; blocked delinquent/unknown states; successful command ждёт webhook, не выдаёт access из response.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.plan-changes.test.ts && bun --filter @doxynix/web test:int src/tests/integration/workspaces.test.ts`

- [ ] **BILL-13 — Customer Portal и cancellation (0.5 дня)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/billing.portal.ts`, `billing.portal.test.ts`; Modify `apps/web/src/server/modules/billing/billing.router.ts`.
  - **Acceptance criteria:** Owner-only scoped Customer; trusted return URL; portal URL не логируется/не сохраняется; cancellation доступен только через настроенный portal; cancel_at_period_end не отключает доступ до deleted/canceled.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.portal.test.ts`

- [ ] **BILL-14 — Refunds, disputes и fraud warnings (1 день)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/billing.risk.ts`, `billing.risk.test.ts`; Modify `apps/web/src/server/modules/billing/billing.resolver.ts`, `billing.events.ts`, `billing.ledger.ts`.
  - **Acceptance criteria:** Endive PaymentIntent→InvoicePayment→Invoice.parent resolver с pagination; natural-key ledger; failed refund/cancel semantics; dispute/fraud alerts; ни один risk handler не меняет Subscription/entitlement автоматически.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.risk.test.ts`

### Operations и проверка

- [ ] **BILL-15 — Nightly reconciliation (1 день)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/billing.reconciliation.ts`, `billing.reconciliation.test.ts`, `tasks/reconcile-stripe.task.ts`; Modify `apps/web/src/server/utils/task-config.ts`; Create `apps/web/src/tests/integration/billing-reconciliation.test.ts`.
  - **Acceptance criteria:** Full pagination, one daily run, canonical mirror repair, unowned/extra fail-closed, append-only money correction, tax/queue checks, issues и >26h alert; zero Stripe writes.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.reconciliation.test.ts && bun --filter @doxynix/web test:int src/tests/integration/billing-reconciliation.test.ts`

- [ ] **BILL-16 — Tax preflight и finalization handling (0.5 дня)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/billing.tax.ts`, `billing.tax.test.ts`; Modify `apps/web/src/server/modules/billing/billing.reconciliation.ts`, `billing.invoices.ts`.
  - **Acceptance criteria:** Active registrations сравниваются с required jurisdictions; missing registration critical; `requires_location_inputs` мапится в `TAX_LOCATION`; нет automatic registration/manual-rate fallback; no-registration sandbox behavior не считается success.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.tax.test.ts`

- [ ] **BILL-17 — Admin replay и observability (0.5 дня)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/billing.admin.ts`, `billing.admin.test.ts`; Modify `apps/web/src/server/modules/billing/billing.router.ts`, `apps/web/src/server/core/posthog-events.ts`.
  - **Acceptance criteria:** Admin+2FA replay с replay suffix; resolve issue; sanitized logs/metrics раздела 15; Sentry critical paths; PostHog не содержит amounts/PII; every test содержит expect.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.admin.test.ts`

- [ ] **BILL-18 — Recorded fixtures и failure-injection suite (1 день)**
  - **Files touched:** Create `apps/web/src/server/modules/billing/test-fixtures/events/subscription-created.json`, `invoice-paid.json`, `invoice-payment-failed.json`, `charge-refunded.json`, `dispute-created.json`, `out-of-order.json`, `apps/web/src/server/modules/billing/billing.fixtures.test.ts`, `billing.faults.test.ts`, `apps/web/src/server/modules/billing/test-fixtures/sign.ts`.
  - **Acceptance criteria:** Sanitized Endive raw payloads; test-only signature helper; bad signature/double delivery/order/API 429/500/network/DB/enqueue failures; deterministic no-sleep assertions; no live secret в fixtures.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/billing/billing.fixtures.test.ts src/server/modules/billing/billing.faults.test.ts && bun run secretlint`

- [ ] **BILL-19 — Полный DB policy/concurrency suite (1 день)**
  - **Files touched:** Create `apps/web/src/tests/integration/billing-webhooks.test.ts`, `billing-idempotency.test.ts`, `billing-ledger.test.ts`; Modify `apps/web/src/tests/helpers.ts`.
  - **Acceptance criteria:** Disposable DB guard сохраняется; concurrent Event/commands/current subscription; policies для owner/member/anonymous/admin; ledger immutable; cleanup покрывает все новые таблицы; regression existing integration tests.
  - **Проверка:** `bun --filter @doxynix/web test:int && bun --filter @doxynix/web test`

- [ ] **BILL-20 — Sandbox test clocks и go-live scenarios (1 день)**
  - **Files touched:** Create `apps/web/vitest.stripe.config.ts`, `apps/web/tests/stripe/test-clocks.test.ts`, `apps/web/tests/stripe/stripe-sandbox.ts`; Modify `apps/web/package.json`.
  - **Acceptance criteria:** Отдельный sandbox; initial/renewal/dunning/recovery/proration/cancel/refund/dispute/tax scenarios; poll processed state; suite не входит в default unit/CI; results задокументированы. Без sandbox credentials статус остаётся `cannot-verify`.
  - **Проверка:** `bun --filter @doxynix/web test:stripe`

- [ ] **BILL-21 — Runbook, live checklist и final gate (0.5 дня)**
  - **Files touched:** Create `docs/runbooks/stripe-billing.md`; Modify `apps/web/.env.example`; Review все новые migrations и Trigger config; обновить ответы раздела 16 по факту.
  - **Acceptance criteria:** Задокументированы RAK least privilege, endpoint events/version, Product/Price/tax code, registrations, Smart Retries 8/2w+ cancellation, Stripe emails, portal limits, rotation/replay/reconciliation/alerts; migration review; format/lint/types/arch/tests зелёные.
  - **Проверка:** `bun run format && bun run validate && bun run test && bun --filter @doxynix/web test:int && bun run secretlint`

### UI (после BILL-21)

> Переключатель воркспейсов и страница участников уже входят в **WS-05** (раздел 20) — здесь их не дублируем. BILL-22 зависит от WS-05, если у пользователя больше одного воркспейса.

- [ ] **BILL-22 — Billing UI: тариф, места, Upgrade/Manage (2–3 дня)**
  - **Files touched:** Create `apps/web/src/app/[locale]/(private)/dashboard/settings/billing/page.tsx` + `_components/`; Create `apps/web/src/features/manage-subscription/{ui,model}`; Modify `apps/web/src/app/[locale]/(private)/dashboard/settings/layout.tsx`, `apps/web/messages/*` (все 12 локалей).
  - **Acceptance criteria:** экран показывает `planCode`, `accessState`, места, лимиты и дату следующего списания из entitlement — без вызова Stripe на рендере; `Upgrade` вызывает `createCheckout` и редиректит на `session.url`; `Manage` вызывает `createPortal` и редиректит; состояния `ACTIVE/GRACE/REVIEW/CANCELED` и ошибки `BILLING_NOT_CHANGEABLE`/`LIMIT_EXCEEDED` отображаются текстом, а не падением; действия доступны только `OWNER`, `MEMBER` видит read-only; URL портала и ключи не логируются и не сохраняются; новые строки во всех 12 локалях; FSD-импорты не нарушены.
  - **Проверка:** `bun run lint:i18n && bun run lint:locales && bun --filter @doxynix/web type-check && bun run lint`

## 18. Open questions — ключевые (6)

1. **Какие tiers и production unit amount?** Рекомендованный default: один `PRO`, $9/seat/month (900 cents) для sandbox и первого production catalog; annual/trials отсутствуют. Бизнес может изменить сумму без изменения архитектуры.
2. **Что делать с существующими пользователями и free personal usage?** Default: личный Workspace бесплатный (`planCode=HOBBY`), один участник, создаётся при регистрации; платным становится тот же Workspace после апгрейда до `PRO`. Бэкфилл не нужен (пользователей нет), Stripe Customers не создаются заранее.
3. **Какой Product Tax Code и в каких US jurisdictions есть регистрации?** Default: не угадывать; paid launch заблокирован до ответа налогового консультанта и active registrations. Код хранится как конфигурация, не legal constant.
4. **Подходит ли 7-дневный grace при 8 retries/2 weeks?** Default: да; доступ отключается на day 7, Stripe продолжает recovery до day 14 и затем cancel. Это бизнес-правило, не ограничение Stripe.
5. **Достаточно ли OWNER для billing actions?** Default: да; отдельные `BILLING_ADMIN` и delegated finance roles не вводим до реального требования.
6. **Какие лимиты у HOBBY, PRO и TEAM?** Default (плейсхолдеры, меняются без релиза): HOBBY — `privateReposAllowed=false`, `reposLimit=NULL`, 20 анализов и 1M AI-токенов в месяц, `autoResync=false`, `prReviews=false`, `historyDays=7`, `seatLimit=1`; PRO — `privateReposAllowed=true`, `reposLimit=NULL`, 500 анализов и 20M токенов на воркспейс в месяц, `autoResync=true`, `prReviews=true`, `historyDays=90`, `seatLimit=quantity`; TEAM — `privateReposAllowed=true`, `reposLimit=NULL`, анализы/токены/`historyDays` без лимита, `autoResync=true`, `prReviews=true`, `seatLimit=quantity`. Квота считается по свежим анализам, кеш её не расходует; превышение — `403 LIMIT_EXCEEDED` на свежий анализ. Допродажа кредитов только в фазе 2. Причина: себестоимость — вычисление на репозиторий, поэтому квота обязательна даже на платном тарифе.

## 19. Assumption log

| Допущение | Основание |
|---|---|
| Per-seat, B2B, США/USD | Ответы пользователя на 3 blocking questions. |
| Tenancy сейчас user-scoped (`Repo.userId`), Workspace отсутствует | Проверено по `prisma/models/auth.zmodel`, `github.zmodel`; модель владения переносится на Workspace в разделе 20 **до** биллинга. |
| Один PRO monthly price, один SubscriptionItem | Минимальный launch default; price ID вне кода. |
| Hosted Checkout + Billing APIs, Customer Portal | Выбрана одна архитектура ради меньшего PCI/UI surface и штатных subscription flows. |
| Dynamic payment methods, automatic collection | Не фиксируем card-only; асинхронные initial payments обрабатываются через `activatedAt`. |
| No trials, annual, scheduled downgrade, usage, invoices-by-email | Сознательный launch scope, а не утверждение об ограничениях Stripe. |
| Immediate upgrade/downgrade; classic billing mode | Одна deterministic proration policy без Subscription Schedules. |
| Manual seat quantity; members включая owner; pending invites отсутствуют | Простое и проверяемое бизнес-правило. |
| Personal Workspace бесплатный, team платный | Один тип сущности; personal = воркспейс с одним участником. Требует подтверждения в Q2. |
| Grace=7 дней, Smart Retries=8/2 недели, затем cancel | Проектный default; Dashboard configuration обязательна. |
| Stripe владеет dunning emails | Не создаём 12-локальные шаблоны и duplicate sends. |
| Snapshot v1 Events + canonical retrieve | Подходит recorded fixtures и текущему Billing object graph; порядок не используется. |
| DB unique важнее Trigger TTL; raw payload 90 дней, Event ID навсегда | Долговременная дедупликация и ограничение PII retention. |
| Append-only ledger operational, не бухгалтерский | Достаточно для audit/reconciliation без новой accounting subsystem. |
| Нет distributed entitlement cache | Correctness при revocation важнее преждевременной оптимизации. |
| Tenancy-эпик (раздел 20) — отдельная ветвь до биллинга | Исключает смешивание cross-subsystem rewrite с деньгами; биллинг стартует с BILL-03. |
| Production Tax configuration недоступна | Поэтому live readiness `cannot-verify`, не выдуманное `yes`. |

---

## 20. Workspace tenancy foundation — обязательный предшествующий эпик

**Цель:** одна модель владения. Workspace владеет ресурсами, User — только личность. Никакой двойной tenancy, никаких nullable-полей и никакого legacy-контура.

### Жёсткие правила

1. `Repo.workspaceId` и `GithubInstallation.workspaceId` — `NOT NULL` с первого дня. Переходных nullable-колонок не существует.
2. `Repo.userId` переименовывается в `createdByUserId` (кто создал), владение — `workspaceId`. Уникальность: `@@unique([owner, name, workspaceId])`, `@@unique([githubId, workspaceId])`.
3. Один Workspace — и личный, и командный. Личный = Workspace с планом `HOBBY` и одним участником; апгрейд до `PRO` делается в нём же (in place), без второй папки. Тип в схеме не хранится — иначе появятся две модели владения. Воркспейс создаётся при регистрации.
4. Каждый tRPC-запрос получает `workspaceId` из контекста и проверяет membership **до** хендлера. Глобальный `ADMIN` — отдельная ветка, не «пустой workspaceId».
5. ZenStack-политики выражаются через membership, а не через `auth().id == userId`. Ни одного `@@allow`, ссылающегося на владение юзером, остаться не должно.
6. Биллинг (BILL-03+) не начинается, пока WS-01…WS-04 не зелёные.
7. Политики `@@allow` для `Workspace`, `WorkspaceMember`, `WorkspaceEntitlement` добавляются в **WS-02** — без них сервис не прочитает эти таблицы через enhanced client (ZenStack по умолчанию запрещает всё). Политики ресурсов (`Repo`, `Analysis`, `Document`, PR-* ) переводятся на membership в WS-03.
8. Personal workspace создаётся при регистрации в одном месте (Better-Auth `databaseHooks.user.create.after`) плюс ленивый fallback в `workspaceProcedure` для пользователей без воркспейса; оба пути покрыты integration-тестом.

### Задачи

- [x] **WS-01 — Схема tenancy (2–3 дня)**
  - **Files touched:** Create `apps/web/prisma/models/workspace.zmodel`; Modify `apps/web/prisma/models/github.zmodel`, `apps/web/prisma/models/auth.zmodel`, `apps/web/prisma/schema.zmodel`, `apps/web/src/tests/helpers.ts`; новая Prisma migration.
  - **Acceptance criteria:** `Workspace` (без поля типа), `WorkspaceMember` (роли `OWNER|MEMBER`, `UNIQUE(workspaceId,userId)`), `WorkspaceEntitlement` (`planCode HOBBY|PRO|TEAM` TEXT, `seatLimit`, `reposLimit` NULL, `analysesPerMonth`, `aiTokensPerMonth`, `privateReposAllowed`, `autoResync`, `prReviews`, `historyDays`); `Repo.workspaceId`/`GithubInstallation.workspaceId` NOT NULL; `createdByUserId` вместо владения; индексы под выборки по воркспейсу; `cleanupDatabase()` покрывает новые таблицы; схема генерируется, `schema.prisma` руками не правится.
  - **Проверка:** `bun --filter @doxynix/web db:generate && (cd apps/web && bun prisma migrate dev --name add_workspaces) && bun --filter @doxynix/web db:push:test && bun --filter @doxynix/web test:int src/tests/integration/workspaces-schema.test.ts`

- [x] **WS-02 — Workspace service/router, контекст и инварианты (2–3 дня)**
  - **Files touched:** Create `apps/web/src/server/modules/workspaces/{workspace.router,workspace.service,workspace.schemas}.ts`, `workspace.service.test.ts`; Modify `apps/web/src/server/core/trpc/init.ts`, `apps/web/src/server/modules/index.ts`; Create `apps/web/src/tests/integration/workspaces.test.ts`.
  - **Acceptance criteria:** `myWorkspaces`, `upgradeToPro`, `addMember`, `removeMember`, `switchWorkspace`; `workspaceProcedure` резолвит `workspaceId` (header `X-Workspace-Id`) и membership; последнего `OWNER` удалить нельзя (serializable transaction); план `HOBBY` не принимает новых участников — UI ведёт в `upgradeToPro` (in place, тот же Workspace); не-member получает `FORBIDDEN`, не `NOT_FOUND`-утечку; `@@allow` для `Workspace`/`WorkspaceMember`/`WorkspaceEntitlement` (member читает свой воркспейс, owner управляет составом, anonymous deny); personal workspace создаётся при регистрации + ленивый fallback для пользователя без воркспейса; router зарегистрирован в `AppRouter`.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/workspaces/workspace.service.test.ts && bun --filter @doxynix/web test:int src/tests/integration/workspaces.test.ts && bun --filter @doxynix/web arch:check`

- [x] **WS-03 — ZenStack-политики через membership (1–2 дня)**
  - **Files touched:** Modify `apps/web/prisma/models/{github,core,review,auth}.zmodel`; Modify `apps/web/src/server/core/trpc/init.ts`.
  - **Acceptance criteria:** все `@@allow` владения переписаны на membership; anonymous deny; чужой воркспейс не читается ни на одной модели; admin-доступ сохранён; регенерация клиента не требует ручных правок.
  - **Проверка:** `bun --filter @doxynix/web db:generate && bun --filter @doxynix/web test:int src/tests/integration/tenancy-isolation.test.ts`

- [x] **WS-04 — Repos, GitHub App, API-keys и analysis на workspaceId (3–4 дня)**
  - **Files touched:** Modify `apps/web/src/server/modules/repos/{repo.router,repo.service,github-app.service}.ts`, `apps/web/src/server/modules/api-keys/api-key.router.ts`, `apps/web/src/server/modules/analysis/*`, Trigger-таски `apps/web/src/server/modules/analysis/tasks/*.task.ts`, `apps/web/src/server/utils/task-config.ts`.
  - **Acceptance criteria:** ни один запрос к `Repo`/`GithubInstallation`/analysis-артефакту не выполняется без фильтра по `workspaceId`; установка GitHub App привязывается к воркспейсу и не переиспользуется между воркспейсами; API-ключи принадлежат воркспейсу; payload Trigger-тасков несёт `workspaceId`, и таск проверяет его перед работой; существующие unit-тесты обновлены, не удалены.
  - **Проверка:** `bun --filter @doxynix/web test src/server/modules/repos src/server/modules/analysis && bun --filter @doxynix/web test:int && bun --filter @doxynix/web arch:check`

- [x] **WS-05 — UI: переключатель воркспейсов и участники (3–5 дней)**
  - **Files touched:** слой FSD в `apps/web/src/{features,widgets}` (точные пути фиксируются на старте задачи), `apps/web/messages/*` — новые ключи во всех 12 локалях.
  - **Acceptance criteria:** переключение воркспейса меняет `X-Workspace-Id` во всех запросах; страница участников доступна только `OWNER`; приглашение добавляет существующего юзера; после смены воркспейса кэши запросов сбрасываются.
  - **Проверка:** `bun run lint:i18n && bun run lint:locales && bun --filter @doxynix/web type-check`

- [x] **WS-06 — Изоляция и общие гейты (1–2 дня)**
  - **Files touched:** Create `apps/web/src/tests/integration/tenancy-isolation.test.ts`; Modify `apps/web/src/tests/helpers.ts`.
  - **Acceptance criteria:** негативные тесты «чужой воркспейс → отказ» покрывают `Repo`, `GithubInstallation`, `RepoApiKey`, analysis-артефакты и чтение documents; ни один тест не проходит при подмене `workspaceId`; `bun run validate` зелёный.
  - **Проверка:** `bun --filter @doxynix/web test:int && bun run validate`

### DoD (бинарно)

| # | Проверка | Ответ |
|---|---|---|
| 1 | `Repo.workspaceId` и `GithubInstallation.workspaceId` — `NOT NULL`, владения через `userId` нет | no |
| 2 | Ни один запрос к репозиториям/артефактам не идёт без фильтра по `workspaceId` | no |
| 3 | Негативные тесты изоляции зелёные для repos, github, api-keys, analysis, documents | no |
| 4 | Один тип Workspace: личный = план `HOBBY` с одним участником; апгрейд идёт in place, вторая папка не создаётся; бэкфилла нет | no |
| 5 | `arch:check`, `type-check`, `bun run validate` зелёные | no |
| 6 | Billing-таблицы ссылаются только на `workspaceId`, `quantity` берётся из числа активных membership | no |

### Оценка и риски

- Итого: **10–14 рабочих дней** (2–3 недели при неполном дне).
- Самый большой риск — WS-04: analysis pipeline и payload'ы Trigger-тасков. Их нельзя делать «заодно» с биллингом.
- Отдельная ветка, отдельные миграции, никакого Stripe-кода в диффе.
- Если нужно выпустить деньги раньше — допускается продажа за аккаунт (`quantity = 1`), но **после** WS-01…WS-04; до этого биллинг не запускается.

---

## Self-check

### Пять утверждений с наименьшей уверенностью

1. **Initial `active` + `activatedAt` корректно закроет все asynchronous payment sequences.** API statuses и 23-hour behavior подтверждены документацией, но полный набор последовательностей для всех Dashboard-enabled async methods нужно доказать sandbox test clocks; до этого это наиболее рискованная проекция.
2. **`classic` + выбранная proration matrix даст ожидаемые invoice totals во всех discount/tax combinations.** Параметры и semantics прочитаны в docs, но суммы зависят от billing mode, налогов и момента изменения; spec не фиксирует ожидаемые cents без preview/sandbox verification.
3. **Smart Retries 8/2 weeks и final cancel будут доступны именно в аккаунте.** Публичная документация подтверждает настройку, но фактический Dashboard аккаунта не читался; это `cannot-verify`, а не предполагаемый факт.
4. **Endive risk resolver покроет все реальные Charge/InvoicePayment variants.** Version-specific flow прочитан, включая multiple invoices и null PaymentIntent, но legacy direct charges без PaymentIntent остаются unresolved по дизайну и попадут в DLQ/issue.
5. **Новые Stripe SDK TypeScript types примут все задокументированные Endive fields без cast.** API reference прочитан, но package ещё не установлен и compile не выполнялся; `integration_identifier` и `billing_mode` должны быть проверены в BILL-04/06. Никаких `any`/silent fallback не планируется.

### Что держится на памяти, а не на прочитанных документах

- Поля/события Stripe, параметры Checkout/Subscriptions, idempotency, webhook ordering/signature/retries, statuses, proration, dunning, tax, refund/dispute graph, test clocks и API version были проверены по локально полученным страницам `stripe docs`; ссылки стоят в спеке.
- Не проверялись и поэтому **не утверждаются**: точные названия RAK permissions в Dashboard, Stripe rate-limit budgets, конкретная доступность tax registrations в аккаунте, актуальная SDK version в lockfile. Вместо них — endpoint-based least-privilege checklist, measurements и `cannot-verify`.
- Проектные значения $20, 7 дней grace, 90 дней payload retention, nightly 04:17 UTC, request-only cache и оценки 0.5–1 дня — инженерные/продуктовые defaults, а не факты Stripe.
