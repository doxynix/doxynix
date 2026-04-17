# 🧹 Cleanup & Improvements Tracker

## Неиспользуемый код (можно удалить)

| Файл | Статус | Причина | Действие |
|------|--------|---------|----------|
| `shared/lib/math-utils.ts` | ❌ Unused | Нет импортов | Удалить когда будет время |
| `shared/lib/prompt-registry.ts` | ⚠️ Reserve | Старая версия кэширования | Оставить на потом |
| `shared/lib/circuit-breaker.ts` | ⚠️ Dupe | Аналог в `call.ts` | Merge в call.ts потом |
| `shared/engine/extractors/regex-signal-specs.ts` | ⚠️ Reserve | Для рефакторинга | Оставить |

**Действие:** Когда будет спокойное время, запустить:
```bash
pnpm lint --fix --max-warnings=0 --no-eslintrc --rule="no-unused-vars: error"
```

---

## TODO комментарии в коде

| Файл | Строка | TODO | Приоритет | Статус |
|------|--------|------|-----------|--------|
| `generated-fix.router.ts` | 141 | Detect language from repo | 🔴 High | ✅ **FIXED** (2026-04-17) |
| `section-graph-linker.ts` | 142 | Track versions | 🔴 High | ✅ **FIXED** (2026-04-17) |
| `shared/types.ts` | 1 | Разгрести типы | 🟡 Medium | ⏳ In queue |
| `infrastructure/repo-snapshots.ts` | 1 | Рефакторинг структуры | 🟡 Medium | 📋 Pending |
| `push-webhook-handler.ts` | 33 | Уточнить логику push events | 🟡 Medium | 📋 Pending |
| `quality-matrix.ts` | 408 | Переход на Temporal | 🟢 Low | 🎯 Future |

---

## Потенциальные улучшения

### 🔴 HIGH PRIORITY

#### 1. Cleanup unused exports
**Файлы:** `shared/lib/optimizers.ts`
**Что:** Некоторые функции экспортируются но не используются
**Когда:** После полного тестирования
**Action:** 
```bash
# Проверить какие функции из optimizers.ts используются
grep -r "from.*optimizers" src/server --include="*.ts"
```

---

### 🟡 MEDIUM PRIORITY

#### 2. Consolidate signal types
**Файлы:** 
- `shared/engine/extractors/regex-signals.ts`
- `shared/engine/extractors/tree-sitter-signals.ts`
- `shared/engine/extractors/typescript-signals.ts`

**Что:** Все returns разные форматы сигналов
**Улучшение:** Единый `BaseSignal` интерфейс
**Status:** ✅ DONE in Phase 2B-3

---

#### 3. Migrate old Document versioning
**Файл:** `documents.router.ts`
**Что:** Hardcoded "1.0" в нескольких местах
**Улучшение:** Использовать `document.version` из DB
**Status:** ✅ DONE (2026-04-17)

---

#### 4. Standardize Error Handling
**Файлы:** All routers
**Что:** Inconsistent error handling patterns
**Улучшение:** Использовать `handle-error.ts` везде
**Action:** 
```typescript
// ❌ Don't do this
return { error: "msg", success: false }

// ✅ Do this
throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "msg" })
```

---

### 🟢 LOW PRIORITY (Future improvements)

#### 5. Extract common metrics calculation
**Где:** `shared/engine/metrics/`
**Что:** Дублирование логики в разных метриках
**Улучшение:** Factory pattern для калькуляторов метрик

#### 6. Add metrics cache layer
**Где:** `analyze-repo.task.ts`
**Что:** Metrics считаются каждый раз с нуля
**Улучшение:** Кэш метрик с инвалидацией по git commit

#### 7. Implement feature flags
**Где:** All feature modules
**Что:** Нет easy way включить/выключить фичу
**Улучшение:** Использовать Prisma prAnalysisConfig

---

## Refactoring Plan

### Phase 1: Cleanup (Уже в прогрессе ✅)
- [x] Fix TODO in generated-fix.router.ts
- [x] Fix TODO in section-graph-linker.ts
- [x] Create MAP.md
- [ ] Remove unused exports from optimizers.ts
- [ ] Delete unused files (math-utils, circuit-breaker)

### Phase 2: Consolidation (Next sprint 📅)
- [ ] Merge logger patterns (consistent logging everywhere)
- [ ] Standardize error handling (use handle-error.ts)
- [ ] Extract validation patterns (reuse Zod validators)

### Phase 3: Optimization (Future 🚀)
- [ ] Add metrics caching
- [ ] Implement feature flags
- [ ] Performance benchmarks

---

## How to track new TODOs

**Правило:** Любой TODO должен содержать:
```typescript
// TODO: [PRIORITY] что именно | файл где решение
// Пример:
// TODO: HIGH - detect repo language from AI analysis | shared/lib/language-metadata.ts

// ❌ Плохо:
// TODO: fix this

// ✅ Хорошо:
// TODO: MEDIUM - implement caching for metrics | shared/engine/metrics/cache.ts
```

---

## Чек-лист перед PR

- [ ] Не осталось `// TODO:` без PRIORITY
- [ ] Не осталось `// FIXME:` без описания
- [ ] `pnpm typecheck` - 0 errors
- [ ] `pnpm lint:fix` - applied
- [ ] Не добавилось новых unused exports

---

## Statistics

| Метрика | Значение |
|---------|----------|
| Total TypeScript files | 155 |
| Unused files | 4 |
| TODO comments | 5 |
| Fixed TODOs (this session) | 2 ✅ |
| Code to cleanup | ~50 lines |
| Estimated cleanup time | 1-2 hours |

---

**Last Updated:** 2026-04-17
**Next Review:** 2026-05-01
