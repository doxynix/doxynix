# 🚀 Quick Reference (Шпаргалка)

## Главные команды

```bash
# Запуск сервера
pnpm dev

# Проверка типов
pnpm typecheck

# Лиинт и форматирование
pnpm lint:fix && pnpm format

# Архитектура (FSD)
pnpm arch:check
```

---

## Главные файлы (держать в закладках)

| Файл | Что там | Когда открывать |
|------|---------|-----------------|
| `analyze-repo.task.ts` | Главная логика анализа | Баги в процессе анализа |
| `ai-pipeline.ts` | Claude вызовы | Менять логику генерации |
| `prompts.ts` | AI промпты | Менять инструкции AI |
| `scoring-constants.ts` | Все скоры и константы | Менять метрики |
| `code-metrics.ts` | analyzeRepository() | Добавить новые метрики |
| `trpc.ts` | TRPC конфиг | Менять middleware, auth |

---

## Архитектура (запомнить)

```
📊 Поток данных: Frontend → TRPC Router → Feature Service → Trigger.dev Task

🗂️ Слои (FSD):
  api/              ← Входные роутеры
  features/         ← Бизнес-логика
  entities/         ← Domain сервисы
  shared/engine/    ← Ядро анализа
  shared/lib/       ← Утилиты
```

---

## Частые задачи

### ❌ "Хочу добавить новый скор"

1. `scoring-constants.ts` → добавить константу
2. `model/metrics/` → функция вычисления
3. `ai-pipeline.ts` → добавить в контекст AI
4. `prompts.ts` → упомянуть в инструкциях

### ❌ "Хочу добавить новый тип документа"

1. `schema.zmodel` → добавить в enum `DocType`
2. `model/writers/` → создать новый writer
3. `prompts.ts` → добавить промпт для типа
4. `generate-docs/formatters/` → форматер

### ❌ "Хочу менять логику PR анализа"

1. `pr-analysis/lib/differential-analyzer.ts` → что анализировать
2. `pr-analysis/lib/fix-generator.ts` → как генерировать фиксы
3. `pr-analysis/lib/comment-poster.ts` → как постить комментарии

### ❌ "Хочу понять процесс анализа"

→ Откройте `analyze-repo.task.ts` и идите по функциям:
1. `initializeEnv()` → 2. `calculateBusFactor()` → 3. `cloneRepository()` → 4. `analyzeRepository()` → 5. `runAiPipeline()` → 6. `generateDeepDocs()` → 7. `persistResults()`

### ❌ "Хочу добавить новый роутер"

1. `api/routers/new.router.ts` → создать
2. `api/routers/index.ts` → экспортировать
3. Используй `protectedProcedure` или `adminProcedure`
4. Добавь input/output Zod схемы

---

## Типичные ошибки

❌ **Не делать:**
- Импорты вверх-вниз по слоям (api → features → entities → shared ТОЛЬКО)
- Использование `any` типов
- Hardcoding (все в constants!)
- Логика в роутерах (только в features/entities)

✅ **Делать:**
- Guard clauses (early returns)
- Логирование через logger
- Zod валидация на входе
- Проверка permissions перед DB операциями

---

## Файловая структура (быстрый поиск)

```
src/server/
├─ api/routers/         ← ВХОДНЫЕ ТОЧКИ (13 роутеров)
├─ features/
│  ├─ analyze-repo/     ← ГЛАВНАЯ ЛОГИКА (анализ)
│  ├─ pr-analysis/      ← PR фиксы
│  ├─ file-actions/     ← Быстрые действия с файлом
│  ├─ generate-docs/    ← Документация
│  └─ github-webhooks/  ← GitHub события
├─ entities/            ← Domain сервисы
├─ shared/
│  ├─ engine/
│  │  ├─ core/         ← Главные типы
│  │  ├─ metrics/      ← Вычисление метрик
│  │  ├─ extractors/   ← Сигналы (что плохо)
│  │  └─ adapters/     ← Парсеры кода
│  ├─ infrastructure/  ← GitHub, DB, Auth
│  └─ lib/             ← Утилиты
└─ MAP.md              ← ТЫ ЗДЕСЬ 👈
```

---

## Как читать ошибки

### TS2304: Не найдена переменная
→ Проверь импорты в начале файла

### "Не удается найти модуль"
→ Путь неправильный или файл не существует

### GraphQL/TRPC ошибка
→ Проверь input schema в роутере

### Timeout анализа
→ Слишком большой репо или Trigger.dev overloaded

### WebSocket не обновляется
→ Проверь realtime channel name совпадает с userId

---

## Контакты кода

| Тема | Файл |
|------|------|
| 🤖 AI промпты | `prompts.ts` |
| 📊 Метрики | `scoring-constants.ts` |
| 🔗 GitHub | `shared/infrastructure/github/` |
| 📝 Документы | `features/generate-docs/` |
| 🐛 Логирование | `shared/infrastructure/logger.ts` |
| 🔐 Безопасность | `shared/lib/safety-context.ts` |

---

✨ **Помни:** Это живой документ! Обновляй когда находишь опечатки или когда появляются новые паттерны
