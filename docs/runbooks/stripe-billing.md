# Stripe billing runbook

Операционный документ для B2B per-seat биллинга. Пока покрывает sandbox-сценарии (BILL-20);
BILL-21 дополнит его live-checklist'ом, ротацией ключей и алертами.

## Окружения и секреты

- Ключи только из Doppler: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_PRO_MONTHLY_USD`, `STRIPE_LIVEMODE`, `STRIPE_TAX_REQUIRED_JURISDICTIONS`.
- Sandbox-сьют запускается отдельным Doppler config'ом (по умолчанию `stripe_sandbox`,
  переопределяется `STRIPE_DOPPLER_CONFIG`):
  ```bash
  bun --filter @doxynix/web test:stripe
  ```
- Guard: пустой ключ, `sk_live_`/`rk_live_` или пустой price id → весь сьют помечается
  `cannot-verify` (skipped), а не падает.

## Предусловия sandbox-прогона

1. Приложение запущено локально и доступно Stripe (`stripe listen --forward-to
   localhost:3000/api/webhooks/stripe`).
2. Webhook endpoint в Dashboard указывает на тот же API version `2026-09-30.endive`.
3. Test clocks разрешены в аккаунте; цена `STRIPE_PRICE_PRO_MONTHLY_USD` — active, usd, month.
4. Тестовая БД — та же, что у приложения (сьют читает `billing_events`/`workspace_entitlements`).

## Сценарии test clocks (`tests/stripe/test-clocks.test.ts`)

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

`cannot-verify` здесь означает ровно одно: в среде исполнителя нет sandbox-ключей Doppler,
поэтому сьют был пропущен. Это не подтверждение и не опровержение сценария.

## Что требует Dashboard-конфигурации

- Webhook endpoint: события раздела 5 плана, API version `2026-09-30.endive`, подпись.
- Stripe Tax: подтверждённый head office, `status=active`, активные регистрации для
  `STRIPE_TAX_REQUIRED_JURISDICTIONS`; без них paid launch заблокирован (`TAX_SETTINGS_INACTIVE`,
  `TAX_REGISTRATION_MISSING`, `TAX_JURISDICTIONS_NOT_CONFIGURED`).
- Customer Portal: payment method, invoices, tax IDs, cancellation; plan/quantity update выключен.
- Smart Retries: 8 попыток / 2 недели, после финальной — cancel subscription; письма о неудачных
  платежах включены.
- Test clocks: включены для sandbox-аккаунта.

## Известные ограничения

- Сьют создаёт реальные объекты в sandbox и записи в БД приложения; запускать только на
  одноразовой среде.
- Ожидание результата — polling `billing_events.status=PROCESSED` с таймаутом 120 секунд;
  фиксированных sleep нет.
- Dispute-сценарий требует `stripe trigger charge.dispute.created --api-version 2025-03-31.basil`
  (дефолтная CLI-фикстура использует удалённый `payment_method_types`).
