# Stripe billing runbook

Эксплуатационный документ для B2B per-seat биллинга (BILL-01…BILL-22). Источник истины по
поведению — `docs/superpowers/plans/2026-10-28-stripe-seat-billing.md`.

## 1. Ключи и доступы

- Все секреты — только Doppler. Значения для sandbox и production лежат в разных config'ах и
  никогда не пересекаются:
  - `STRIPE_API_KEY` — restricted API key;
  - `STRIPE_WEBHOOK_SECRET` — секрет endpoint'а (свой у каждого окружения);
  - `STRIPE_PRICE_PRO_MONTHLY_USD` — Price ID;
  - `STRIPE_LIVEMODE` — `false` для sandbox, `true` для production;
  - `STRIPE_TAX_REQUIRED_JURISDICTIONS` — список ISO-кодов стран через запятую.
- Минимальные permissions restricted key (Dashboard → Developers → API keys):
  - Customers: write;
  - Checkout Sessions: write;
  - Subscriptions: read/write;
  - Invoices: read/write (нужен `invoices.createPreview`);
  - Invoice Payments: read;
  - Charges: read;
  - Refunds: read;
  - Disputes: read;
  - Prices: read;
  - Products: read;
  - Tax Settings: read;
  - Tax Registrations: read;
  - Billing Portal Sessions: write;
  - Test Clocks: write (только sandbox-ключ).
- Ротация: создать новый ключ → положить в Doppler → задеплоить → убедиться, что
  `stripe balance.retrieve()` проходит → отозвать старый. Webhook secret ротируется через
  roll секрета endpoint'а; новый `whsec` — в Doppler, затем redeploy.
- Секреты, payload, email и суммы не логируются; в Sentry уходят только id/типы.

## 2. Stripe Dashboard

- **Webhook endpoint**: `https://<app>/api/webhooks/stripe`, API version `2026-09-30.endive`
  (версия задаётся на endpoint'е, не только в SDK). Подписанные события:
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`,
  `customer.subscription.created|updated|deleted|paused|resumed`,
  `invoice.paid|payment_failed|finalization_failed`, `invoice_payment.paid`,
  `charge.refunded`, `refund.created|updated|failed`,
  `charge.dispute.created|updated|closed`, `radar.early_fraud_warning.created`.
- **Product/Price**: один Product, один recurring Price monthly USD. `STRIPE_PRICE_PRO_MONTHLY_USD`
  должен указывать на **$9/место (900 cents)**, а не на старый 2000:
  ```bash
  stripe prices retrieve "$STRIPE_PRICE_PRO_MONTHLY_USD"
  # unit_amount=900, currency=usd, recurring.interval=month, active=true
  ```
- **Tax code продукта**: выставляется по подтверждению налогового консультанта (digital
  products), не угадывается кодом.
- **Tax registrations**: активные регистрации для каждой обязательной юрисдикции из
  `STRIPE_TAX_REQUIRED_JURISDICTIONS`; без них paid launch заблокирован.
- **Smart Retries**: 8 попыток / 2 недели, после финальной — cancel subscription. Письма о
  неудачных платежах включены (Stripe emails), свои dunning-шаблоны не делаем.
- **Customer Portal**: включены payment method, invoices, tax IDs, cancellation; обновление
  plan/quantity выключено. Отмена — только через Portal, своего cancel-эндпоинта нет.
- **Managed Payments**: должен быть **выключен**. Проверка:
  ```bash
  stripe subscriptions retrieve <sub_id> | grep -A2 managed_payments
  # managed_payments.enabled должно отсутствовать или быть false
  ```
  Если включён — Stripe работает как Merchant of Record (Link как продавец, налоговая
  ответственность Stripe), а не как процессор; биллинг-модель плана этого не предполагает.

## 3. Recovery-процедуры

- **DLQ**: `billing_events.status = DEAD_LETTER`. Переиграть через admin-процедуру
  `billing.replayEvent({ billingEventId })` (admin + 2FA): новый run с ключом
  `${stripeEventId}:replay:${replayCount + 1}`, `replayCount` инкрементится.
- **Issue**: `billing.listIssues({ status, severity, cursor })`; закрыть —
  `billing.resolveIssue({ issueId, note? })` (note санитизируется, URL/email редактируются).
- **Диагностика события**:
  ```sql
  SELECT id, type, status, attempts, replay_count, last_error, trigger_run_id, received_at
  FROM billing_events WHERE status <> 'PROCESSED' ORDER BY received_at;
  ```
  `last_error` — усечённый код/сообщение, без payload.
- **Reconciliation вручную**: Trigger-таск `billing-reconcile-stripe` (cron `17 4 * * *` UTC)
  можно запустить из Dashboard/CLI; повторный запуск в тот же UTC-день пропускается
  (`billing_reconciliation_runs.scheduled_for_date` unique). Никаких Stripe writes.
- **Sweeper**: `billing-sweep-stripe-events` каждые 15 минут (окно 5 минут) переигрывает
  `RECEIVED/PROCESSING` старше 15 минут и `ENQUEUED` старше 30 минут.

## 4. Локальная разработка

- `trigger.config.ts` использует runtime `node`. Возврат на `bun-1.4` — только после апгрейда
  Trigger.dev до `>= 4.8.2` (Bun 1.4.3 ломает `--no-warnings`).
- `trigger dev` переписывает `apps/web/prisma/schema.prisma` (удаляет генераторы). После
  запуска воркера: `git restore apps/web/prisma/schema.prisma`.
- `stripe listen --all-snapshot --forward-to localhost:3000/api/webhooks/stripe`: локальный
  `whsec` отличается от Dashboard-секрета; для `test:stripe` и ручных прогонов использовать
  секрет из вывода CLI.
- Смена роли/бана в БД не действует до перелогина: роль и бан кешируются в сессии.
- `test:stripe` требует отдельный Doppler config (`STRIPE_DOPPLER_CONFIG`, по умолчанию
  `stripe_sandbox`); без ключей сьют помечается `cannot-verify`.

## 5. Алерты

Critical issues (создаются в `billing_issues`, всплывают в Sentry):
`EVENT_DEAD_LETTER`, `UNOWNED_STRIPE_OBJECT`, `PAYLOAD_HASH_MISMATCH`, `DISPUTE_OPENED`,
`EARLY_FRAUD_WARNING`, `TAX_SETTINGS_INACTIVE`, `TAX_REGISTRATION_MISSING`,
`TAX_JURISDICTIONS_NOT_CONFIGURED`, `TAX_LOCATION`, `TAX_NOT_COLLECTED`, `MISSING_IN_STRIPE`,
`MISSING_INVOICE`, `RECONCILIATION_STALE`, `RECONCILIATION_FAILED`, `OWNER_MISMATCH`.
Warning: `EVENT_QUEUE_STALLED`, `SEATS_BELOW_MEMBERS`.

Пороги из §15 плана: >5% webhook failures за 5 минут; oldest unprocessed >2 минуты;
нет successful reconciliation >26 часов; любой DLQ. PostHog — только продуктовые события,
без сумм и PII.

## 6. Sandbox-сценарии test clocks

Сьют: `bun --filter @doxynix/web test:stripe` (`tests/stripe/test-clocks.test.ts`).

| # | Сценарий | Статус |
|---|---|---|
| 1 | Initial sync payment → `ACTIVE` | cannot-verify |
| 2 | Renewal +1 месяц → `invoice.paid`, `activatedAt` не меняется | cannot-verify |
| 3 | Dunning: decline → `payment_failed` → `GRACE` 7 дней → `SUSPENDED`, повторные фейлы grace не продлевают | cannot-verify |
| 4 | Recovery: оплата внутри grace → `ACTIVE`, grace очищен | cannot-verify |
| 5 | Proration: 1→3 `always_invoice`, 3→1 `create_prorations` | cannot-verify |
| 6 | Cancel через Portal API → доступ до конца периода, затем `CANCELED` | cannot-verify |
| 7 | Refund → ledger-запись, entitlement не меняется | cannot-verify |
| 8 | Tax без регистрации → finalization failure → `TAX_LOCATION` | cannot-verify |

`cannot-verify` означает, что в среде исполнителя нет sandbox-ключей Doppler, и сьют был
пропущен. Dispute-сценарий требует
`stripe trigger charge.dispute.created --api-version 2025-03-31.basil` (дефолтная CLI-фикстура
использует удалённый `payment_method_types`).

## 7. Известные ограничения

- Сьют создаёт реальные объекты в sandbox и записи в БД приложения — только одноразовая среда.
- Ожидание результата — polling `billing_events.status=PROCESSED` с таймаутом 120 секунд.
- `waitForEvent` фильтрует по типу события, не по объекту: при параллельных подписках возможна
  ложная ранняя отсечка.
- Локальный `whsec` из `stripe listen` не совпадает с Dashboard; не путать окружения.
