# 🗺️ Server Architecture Map

**Размер:** 155 TypeScript файлов, 1.2MB | **Версия:** Q2 2026

---

## 🚀 Что сервис умеет

| Возможность | Где находится | Статус |
|---|---|---|
| **Анализ кодовой базы** | `features/analyze-repo/` | ✅ Основной функционал |
| **Генерация документации** | `features/generate-docs/` | ✅ 6 типов документов |
| **Анализ PR с фиксами** | `features/pr-analysis/` | ✅ С постингом комментариев |
| **Действия с файлами** | `features/file-actions/` | ✅ Синхронный аудит |
| **GitHub интеграция** | `shared/infrastructure/github/` | ✅ App + OAuth + Webhooks |
| **Метрики кода** | `shared/engine/metrics/` | ✅ 5 скоров качества |
| **API и документация** | `api/documents.router` | ✅ REST endpoints |
| **Аналитика** | `api/analytics.router` | ✅ Дашборд тренды |
| **Real-time обновления** | `shared/infrastructure/realtime.ts` | ✅ WebSocket |

---

## 📁 Структура проекта

### **api/** - TRPC роутеры (13 шт)
Точка входа для фронтенда. Каждый роутер = отдельный домен.

```
├─ health.router              → Проверка здоровья
├─ repo.router                → CRUD репозиториев
├─ repo-analysis.router       → Запуск/статус анализа (KEY!)
├─ repo-details.router        → Получение результатов анализа
├─ documents.router           → README/API/Architecture/etc
├─ pr-analysis.router         → Конфиг и управление PR анализом
├─ generated-fix.router       → Создание и применение фиксов
├─ github-browse.router       → Просмотр файлов через GitHub API
├─ github-app.router          → Интеграция GitHub App
├─ analytics.router           → Дашборд и метрики
├─ notifications.router       → Уведомления
├─ api-key.router             → API ключи пользователя
└─ user.router                → Профиль пользователя
```

**⚡ ГЛАВНЫЙ ENTRY POINT:** `repo-analysis.router.ts`
- `.analyze(repoId)` → триггерит Trigger.dev задачу
- `.getStatus(analysisId)` → прогресс анализа
- `.analyzeFile()` → быстрый аудит одного файла

---

### **features/** - Бизнес-логика (основная работа)

#### 🔴 **analyze-repo/** - ГЛАВНАЯ ФИЧА (анализ репозиториев)
```
├─ task/
│  └─ analyze-repo.task.ts ⚠️ [230+ строк, КРИТИЧЕСКИЙ ФАЙЛ]
│     Orchestrates: cloning → metrics → AI pipeline → docs → save
│     Машина: medium-1x, таймаут 20 мин, очередь concurrency=2
│
├─ model/
│  ├─ stages/
│  │  ├─ sentinel.ts          → Начальный анализ структуры
│  │  ├─ mapper.ts            → Обнаружение модулей и зависимостей
│  │  └─ architect.ts         → Определение паттернов и рисков
│  │
│  ├─ writers/                → Генераторы документов (README, API, etc)
│  ├─ metrics/                → Вычисление скоров
│  ├─ utils/                  → Парсинг кода, токен бюджеты
│  └─ ai-pipeline.ts ⚠️       → Claude API вызовы + промпты
│
├─ lib/
│  ├─ prompts.ts              → AI промпты для каждого этапа
│  ├─ context-manager.ts      → Подготовка данных для AI
│  ├─ section-graph-linker.ts → Линкование doc-ов к граф узлам
│  └─ scoring-constants.ts    → Все магические константы (FIND HERE!)
│
└─ api/
   └─ repo-analysis.service.ts → Координация и сохранение результатов
```

**КОГДА ЧТО МЕНЯТЬ:**
- Меняется логика анализа → `ai-pipeline.ts` + `stages/`
- Новый тип документа → `model/writers/` + `prompts.ts`
- Нужны новые скоры → `model/metrics/` + `scoring-constants.ts`
- Баги в процессе → `analyze-repo.task.ts`

---

#### 🔵 **pr-analysis/** - Анализ PR'ов с автоматическими фиксами
```
├─ task/
│  └─ analyze-pr.task.ts      → Trigger.dev задача (запускается из вебхука)
│     Процесс: diff → AI findings → generate fixes → post comments
│
├─ lib/
│  ├─ differential-analyzer.ts → Git diff → выявление изменений
│  ├─ fix-generator.ts         → AI генерирует patched files
│  ├─ comment-poster.ts        → Постит комментарии в GitHub
│  └─ pr-config.ts             → Конфигурация анализа PR (verbosity level)
│
└─ model/
   └─ pr-types.ts              → Finding, Comment, Risk types
```

**ENTRY POINT:** GitHub webhook (push/PR event) → `repository-webhook-handler.ts`

---

#### 🟢 **file-actions/** - Синхронные действия с отдельными файлами
```
├─ task/
│  ├─ analyze-single-file.ts  → Quick audit одного файла
│  └─ document-single-file.ts → Быстрая документация одного файла
│
└─ model/
   ├─ file-auditor.ts         → Анализ одного файла
   └─ file-documenter.ts      → Документирование одного файла
```

**КОГДА ИСПОЛЬЗОВАТЬ:**
- Пользователь кликнул на файл → analyzeFile()
- Нужен быстрый результат (<5 сек) → file-actions вместо полного анализа

---

#### 🟡 **generate-docs/** - Генерация документации
```
├─ formatters/                → README, API, Architecture formatters
└─ orchestration.ts           → Координация всех типов документов
```

---

#### 🟠 **github-webhooks/** - GitHub события
```
├─ installation-webhook-handler.ts  → GitHub App install/uninstall
├─ push-webhook-handler.ts          → Push events (может триггерить анализ)
├─ repository-webhook-handler.ts    → Sync метаданных репо
└─ pr-webhook-handler.ts            → PR события → analyze-pr task
```

**⚠️ ВАЖНО:** Все вебхуки находятся в `app/api/webhooks/github/route.ts` и ВЫЗЫВАЮТ эти обработчики

---

### **entities/** - Слой сущностей (isolate по доменам)
```
├─ analyze/api/
│  └─ analytics.service.ts    → Дашборд метрики
│  └─ repo-details.service.ts → Получение деталей анализа
│
├─ repo/api/
│  └─ repo.service.ts         → CRUD репозиториев
│
├─ pr-analysis/api/
│  └─ generated-fix.service.ts → CRUD фиксов
│  └─ pr-analysis.service.ts   → CRUD PR анализов
│
├─ api-key/api/
│  └─ api-key.service.ts       → CRUD API ключей
│
├─ notification/api/
│  └─ notification.service.ts  → Уведомления
│
└─ user/api/
   └─ user.service.ts          → Профиль пользователя
```

**ПРАВИЛО:** entities независимы от features, используют shared только

---

### **shared/** - Переиспользуемое (1.2MB, ядро проекта)

#### 🧠 **engine/** - ЯДРО АНАЛИЗА (где происходит главная работа)
```
├─ core/
│  ├─ types.ts                → Главные типы (Evidence, Metrics, Module, Signal)
│  ├─ common.ts               → Функции работы с путями, файлами
│  ├─ analysis-result.schemas.ts → Zod схемы результатов анализа
│  ├─ structure.ts            → analyzeRepositoryStructure()
│  └─ discovery.ts            → Поиск entry points, routes, configs
│
├─ adapters/                  → Парсеры кода (tree-sitter, TS, regex)
│  ├─ tree-sitter.adapter.ts
│  ├─ typescript.adapter.ts
│  ├─ regex.adapter.ts
│  └─ ...
│
├─ extractors/                → Сигналы (что "плохо" в коде)
│  ├─ tree-sitter-signals.ts
│  ├─ regex-signals.ts
│  ├─ typescript-signals.ts
│  ├─ language-metadata.ts    → Языкоспецифичные фишки
│  └─ openapi-inventory.ts    → API schemas
│
├─ metrics/
│  ├─ code-metrics.ts ⚠️      → analyzeRepository() [ГЛАВНАЯ ФУНКЦИЯ]
│  │                            Вычисляет: complexity, duplication, churn, etc
│  │
│  ├─ bus-factor.ts           → Ключевые разработчики
│  ├─ churn-hotspots.ts       → Часто менящиеся места
│  └─ code-coupling.ts        → Зависимости между файлами
│
└─ evaluation/
   └─ quality-matrix.ts       → Оценка качества документации
```

**⚡ ГЛАВНЫЕ ФУНКЦИИ:**
- `analyzeRepository()` (код-метрики) → shared/engine/metrics/code-metrics.ts
- `analyzeRepositoryStructure()` → shared/engine/core/structure.ts
- `discoverEntryPoints()` → shared/engine/core/discovery.ts

---

#### 🔌 **infrastructure/** - Внешние интеграции
```
├─ github/
│  ├─ github-provider.ts      → Octokit client factory (OAuth или App)
│  └─ github-browse.ts        → List branches, get files, etc
│
├─ db.ts                      → Prisma + Zenstack (row-level security)
├─ logger.ts                  → Структурированное логирование
├─ realtime.ts                → WebSocket каналы (progress updates)
├─ posthog-server.ts          → Аналитика событий
└─ auth.ts                    → NextAuth конфиг + session
```

---

#### 📚 **lib/** - Утилиты (23 файла)
```
├─ prompt-builder.ts          → Fluent API для строящения промптов
├─ prompt-rules.ts            → 70+ переиспользуемых инструкций для AI
├─ evidence-formatter.ts      → Форматирование доказательств (XML/JSON)
├─ safety-context.ts          → Безопасность: escaping, sanitization
│
├─ string-utils.ts            → hasText(), unique()
├─ array-utils.ts             → uniquePaths(), compactArrays()
├─ path-operations.ts         → joinPath(), normalizePath()
│
├─ request-context.ts         → Извлечение userId, path из запроса
├─ sanitize-payload.ts        → Валидация input payload
├─ handle-error.ts            → Единая обработка ошибок
│
├─ pagination.ts              → Пагинация и лимиты
├─ search.ts                  → Полнотекстовый поиск
├─ call.ts                    → Retry logic + circuit breaker
├─ tokenizer.ts               → Подсчет tokens для Claude API
├─ markdown-to-html.ts        → Конвертация документов
├─ language-metadata.ts       → Языкоспецифичные константы
└─ ... (еще 10+)
```

---

## 🔄 Главные потоки данных

### 1️⃣ **Анализ репозитория** (самый важный)
```
Фронтенд: POST /api/trpc/repo-analysis.analyze
  ↓
repo-analysis.router.ts (.analyze procedure)
  ├─ Fetch repo metadata
  ├─ Trigger Trigger.dev task
  └─ Return analysisId (для отслеживания прогресса)
  
Trigger.dev: analyze-repo.task.ts выполняется (20 минут)
  ├─ Clone репо → git operations
  ├─ analyzeRepository() → metrics (5-10 min)
  ├─ runAiPipeline() → Claude AI анализ (5-10 min)
  │   ├─ Sentinel stage (структура)
  │   ├─ Mapper stage (модули/зависимости)
  │   └─ Architect stage (риски/паттерны)
  ├─ generateDeepDocs() → README, API, Architecture
  └─ Save: Analysis + Documents + Evidence в DB
  
WebSocket: Real-time updates → analysisProgress channel
  └─ Progress: 0% → 25% → 50% → 100%

Фронтенд: GET /api/trpc/repo-details.getById
  └─ Получает результаты анализа (после завершения)
```

### 2️⃣ **PR Analysis** (когда PR открыт)
```
GitHub webhook: pull_request event
  ↓
pr-webhook-handler.ts
  ├─ Create PullRequestAnalysis record
  └─ Trigger analyze-pr task
  
Trigger.dev: analyze-pr.task.ts выполняется
  ├─ Git diff базового + PR кода
  ├─ Differential анализ (какие файлы поменялись)
  ├─ AI findings (что не так в изменениях)
  ├─ Generate fixes (AI предлагает patched code)
  └─ Post comments в GitHub
  
GitHub: Comments появляются на changed lines
```

### 3️⃣ **Document Retrieval** (когда пользователь читает доки)
```
Фронтенд: GET /api/trpc/documents.getWithGraphLinks
  ↓
documents.router.ts
  ├─ Fetch Document from DB (markdown content)
  ├─ Fetch Analysis (для dependency graph)
  ├─ DocumentGraphLinker.linkSectionsToGraph()
  │   └─ Parse headings → Match graph nodes
  └─ Return: sections с graphNodeIds для UI
```

---

## ⚠️ Неиспользуемый код (можно удалить)

| Файл | Статус | Почему |
|------|--------|--------|
| `shared/lib/math-utils.ts` | ❌ Не используется | Нет импортов в проекте |
| `shared/lib/prompt-registry.ts` | ❌ Не используется | Старый вариант кэширования |
| `shared/lib/circuit-breaker.ts` | ⚠️ Дублирует | Аналогичная логика в `call.ts` |
| `shared/engine/extractors/regex-signal-specs.ts` | ⚠️ Для рефакторинга | Возможно reserv. для future |

**Рекомендация:** Перед удалением пройдитесь по `pnpm lint` и `pnpm typecheck` с `--noUnusedLocals` флагом.

---

## 🚨 Критические файлы (не трогать!)

| Файл | Почему | Сложность |
|------|--------|-----------|
| `analyze-repo.task.ts` | Главная логика анализа | 🔴 Очень высокая |
| `shared/engine/metrics/code-metrics.ts` | analyzeRepository() | 🔴 Очень высокая |
| `api/trpc.ts` | Конфиг TRPC middleware | 🟠 Высокая |
| `shared/engine/core/` (вся папка) | Ядро типов | 🟠 Высокая |
| `ai-pipeline.ts` | Claude API вызовы | 🟠 Высокая |

**Минимальные изменения** (безопасно):
- `api/routers/*.ts` - каждый независим
- `shared/lib/` - низкие зависимости
- Утилиты в `lib/` типа `string-utils.ts`

---

## 📊 Размеры

| Область | Размер | Файлы |
|---------|--------|-------|
| **shared/engine/** | ~400KB | 45 |
| **shared/lib/** | ~200KB | 23 |
| **features/analyze-repo/** | ~300KB | 35 |
| **features/pr-analysis/** | ~150KB | 18 |
| **api/routers/** | ~150KB | 13 |
| **entities/** | ~50KB | 12 |
| **shared/infrastructure/** | ~60KB | 8 |
| **Итого** | **1.2MB** | **155** |

---

## 🔍 Как найти конкретное

### "Где код для анализа метрик?"
→ `shared/engine/metrics/code-metrics.ts`

### "Где AI промпты?"
→ `features/analyze-repo/lib/prompts.ts`

### "Где GitHub интеграция?"
→ `shared/infrastructure/github/`

### "Где webhook обработчики?"
→ `features/github-webhooks/`

### "Где валидация данных?"
→ `shared/lib/safety-context.ts` + `sanitize-payload.ts`

### "Где дашборд данные?"
→ `entities/analyze/api/analytics.service.ts`

### "Где TRPC конфиг?"
→ `api/trpc.ts`

---

## ✅ Чек-лист перед изменениями

- [ ] Понял структуру FSD (api → features → entities → shared)
- [ ] Выбрал правильный слой для кода (business logic → features, utils → shared)
- [ ] Нет импортов из sibling или upward слоев
- [ ] Тип-безопасно (no `any`)
- [ ] Запустил `pnpm typecheck`
- [ ] Запустил `pnpm lint:fix`
- [ ] Тесты зеленые (если есть)

---

## 📝 Обновлено: 2026-04-17

**Версия:** 1.0
**Следующее обновление:** Когда появятся новые features или крупный рефакторинг
