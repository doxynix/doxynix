# Semgrep Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать Semgrep предсказуемым гейтом качества для монорепо: один вход `bun run security:semgrep`, зафиксированная версия, ноль необъяснённых находок, PR-гейт только по диффу.

**Architecture:** Скан настраивается тремя слоями, каждый из которых принимает решение одного типа: `.semgrepignore` вырезает код, который мы не пишем; `scripts/semgrep.ts` держит единственный набор флагов (правила, исключения, пин версии); `.semgrep/rules/` содержит копии двух шумных registry-правил с allowlist проверенных путей. Всё, что нельзя решить на уровне файла или правила, подавляется построчным `nosemgrep` с id правила и причиной. CI вызывает тот же bun-скрипт, поэтому локальный и CI-прогон не могут разойтись.

**Tech Stack:** Semgrep CLI `1.182.1` (пин), Bun `1.4.3`, TypeScript strict, GitHub Actions, `pipx`, Vitest (только для `apps/web`).

**Spec:** этот документ. §1 — результат аудита `semgrep scan --config p/default .` (57 находок, прогон 2026-11-01), §2 — политика триажа, §3 — целевая структура, §4 — определение готовности. Задачи 0–9 — реализация.

## Global Constraints

- Только Bun; `npm`/`yarn`/`pnpm` запрещены. Финальный гейт — `bun run validate`.
- Semgrep пинится в трёх местах и всегда одинаково: `scripts/semgrep.ts` (`SEMGREP_VERSION`), `.github/workflows/global-ci.yml` (`pipx install "semgrep==..."`), `docs/runbooks/semgrep.md`.
- Версия в этом плане — `1.182.1` (локальный `semgrep --version` на момент написания). Если у исполнителя другая — он меняет одно значение в трёх местах, а не подгоняет окружение.
- Все команды скана запускаются **из корня репозитория**: `paths.exclude` и `.semgrepignore` считаются от корня.
- `--no-rewrite-rule-ids` обязателен: иначе локальные правила получают префикс от пути (`semgrep.rules.…`), и `nosemgrep`/`--exclude-rule` становятся нестабильными.
- Комментарии в коде — по-английски, максимум две строки, с причиной (AGENTS.md). Функциональные директивы (`nosemgrep`) обязаны нести id правила и причину.
- Не подавлять правило `p/default` построчно «пачкой»: систематический шум лечится `--exclude-rule` (правило целиком) или копией правила с `paths.exclude`.
- Не редактировать сгенерированные файлы: `apps/web/prisma/schema.prisma`, `config.generated.ts`, `packages/shared/src/enums/index.ts`, `messages/en.d.json.ts`.
- Новые файлы — kebab-case; после `bun run format` рабочее дерево не должно меняться.
- Никаких `--no-verify`. Ветка — `<type>/dxnx-<n>-<kebab>` (Lefthook проверяет `dxnx`-префикс).
- Новых секретов в этой работе нет. Задача 4 наоборот сужает существующий.

---

## 1. Аудит: 57 находок, что из них правда

Прогон был `semgrep scan --config p/default .` без `--error` и без политики. Механика важнее цифры: бейдж `Blocking` в `scan` ставится всем находкам, когда политики нет, а exit code без `--error` всегда `0`. Проверено на 1.182.1:

```
$ semgrep scan --config <rule> . ; echo $?        # 0
$ semgrep scan --config <rule> . --error; echo $? # 1
```

То есть «57 blocking» ничего не блокировало.

### 1.1 Реальное (2 фикса + 1 принятый риск)

| Находка | Почему реально | Действие | Задача |
|---|---|---|---|
| `.github/workflows/web-ci.yml:40` `PRISMA_FIELD_ENCRYPTION_KEY` в workflow-level `env:` | Единственный настоящий `secrets.*` в этом блоке (остальные 40 — литералы `"dummy-*"`). Доступен каждому шагу каждого job, включая `bun install`. | Вынести в `env:` трёх job'ов, которые трогают БД | 4 |
| `apps/web/src/server/core/field-encryption/cipher.ts:90` `gcm-no-tag-length` | Тег обрезается как `subarray(len - 16)`, но `createDecipheriv` не сообщает Node ожидаемую длину; при усечённом конверте `subarray(-n)` подставляет короткий тег. | `{ authTagLength: AUTH_TAG_BYTES }` + guard на длину | 5 |
| `apps/siem-server/.../scan.engine.ts:51`, `rules.schema.ts:9`, `packages/shared/src/schemas/siem/index.ts:126` `detect-non-literal-regexp` | Пользователь создаёт SIEM-правило с произвольным regex; `isValidRegex` проверяет только синтаксис, не катастрофический бэктрекинг. | Признать риск явно (`nosemgrep` + тикет), закрытие — отдельным планом | 6 |

### 1.2 Систематический шум правила → `--exclude-rule`

| Правило | Локаций | Почему правило не подходит репозиторию |
|---|---|---|
| `javascript.audit.detect-replaceall-sanitization.detect-replaceall-sanitization` | 10 (`code-preview.tsx`, `safety-context.ts`) | Требует DOMPurify там, где экранируются `& < > "` в текстовом контексте `<pre><code>`. Экранирование корректное, библиотека неприменима. |
| `typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml` | 6 | Заменяется копией правила с allowlist (задача 2): новые пути падают, 6 проверенных не шумят. |
| `javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp` | 7 | Заменяется копией с allowlist (задача 2) + 3 подавления в SIEM (задача 6). |
| `generic.secrets.security.detected-stripe-api-key.detected-stripe-api-key` | 2 | Дублирует `gitleaks` + `secretlint`; оба срабатывания — фикстуры `sk_live_aaaa…`. |
| `generic.secrets.security.detected-jwt-token.detected-jwt-token` | 1 | То же; фикстура в `sanitize-payload.test.ts`. |
| `package_managers.bun.bun-missing-minimum-release-age.bun-missing-minimum-release-age` | 1 | `bunfig.toml` содержит `minimumReleaseAge = 259200` (3 дня); правило захардкодило 7 дней. |
| `package_managers.renovate.renovate-missing-minimum-release-age.renovate-missing-minimum-release-age` | 1 | `renovate.json` содержит `"minimumReleaseAge": "3 days"`; правило ищет 7 дней внутри `packageRules`. |

### 1.3 Вендоренный код → `.semgrepignore`

| Файл | Находок |
|---|---|
| `.agents/skills/brainstorming/scripts/helper.js` | 1 (insecure websocket) |
| `.agents/skills/brainstorming/scripts/server.cjs` | 4 (3 path-traversal, 1 http-server) |
| `.agents/skills/mcp-builder/scripts/evaluation.py` | 1 (defusedxml) |

Это чужие скрипты из скиллов; `renovate.json` уже содержит `ignorePaths: [".agents/**"]`. Они же причина, почему в прогоне участвовало 243 python-правила на 13 файлов.

### 1.4 Точечные false positive → построчный `nosemgrep`

| Файл:строка | Правило | Причина |
|---|---|---|
| `apps/web/src/shared/ui/kit/console-easter-egg.tsx:50` | `unsafe-formatstring` | `console.info("%c…")` — статичный баннер, не `util.format`. |
| `scripts/clean-symlinks.ts:40,50` | `unsafe-formatstring` | `console.error` с шаблоном и объектом ошибки, пользовательского ввода нет. |
| `apps/web/scripts/mutate-single.mjs:73` | `spawn-shell-true` | Аргументы — CLI-флаги самого разработчика; `shell` нужен для `.cmd`-шимов на Windows. |
| `apps/web/scripts/zenstack-gen.ts:5` | `spawn-shell-true` | Полностью хардкоженная команда; `shell` нужен для `bunx`-шима. |
| `…/field-encryption/cipher.test.ts:41` | `unknown-value-with-script-tag` | Строка `<script>` внутри тестового plaintext, `RAW_KEY` — литерал `Buffer`. |
| `…/field-encryption/rewrite.test.ts:21` | `prototype-pollution-loop` | Обход локальной JSON-фикстуры в тесте. |
| `.github/scripts/ci-notify.py:42` | `dynamic-urllib-use-detected` | URL собирается из хардкоженной базы GitHub API, схема `file://` недостижима. |

### 1.5 Сводка

- Правда: 2 фикса + 1 принятый риск с тикетом.
- Шум правила: 5 правил выключаются целиком (23 локации), 2 правила заменяются копиями с allowlist (13 локаций).
- Вендоренный код: 6 локаций в `.semgrepignore`.
- Точечные FP: 8 локаций в 7 файлах, 8 комментариев `nosemgrep`.

---

## 2. Политика триажа (обязательна для будущих находок)

Решать **в этом порядке**, не перескакивая:

1. **Код не наш** (`.agents/**`, `patches/**`, сгенерированное) → `.semgrepignore`. Одно место, одна причина.
2. **Правило не подходит репозиторию целиком** (дублирует другой инструмент, требует неприменимый подход) → `--exclude-rule` в `scripts/semgrep.ts` с комментарием «почему».
3. **Правило верное, но конкретные пути проверены** → копия правила в `.semgrep/rules/` с `paths.exclude`. Причина — почему источник безопасен, а не «так исторически сложилось».
4. **Одна строка проверена** → `nosemgrep: <rule-id> — <причина>` на строке находки или строкой выше.
5. **Непонятно** → не подавлять. Оставить красным, завести тикет. Красный гейт — информация; зелёный при живом дефекте — дезинформация.

Запрещено: голый `nosemgrep` без id, `nosemgrep` без причины, «временно» без ссылки на тикет.

---

## 3. Целевая структура файлов

```
.semgrepignore                               # что не сканировать никогда
.semgrep/rules/
  dxnx-non-literal-regexp.yaml               # копия registry-правила + allowlist
  dxnx-react-dangerously-set-inner-html.yaml # копия registry-правила + allowlist
scripts/semgrep.ts                           # единственный вход: full / diff / test
docs/runbooks/semgrep.md                     # установка, режимы, политика
.github/workflows/global-ci.yml              # 3 шага в job `security`
```

| Файл | Ответственность |
|---|---|
| `.semgrepignore` | Границы «нашего» кода. Меняется редко, только для вендоренного/сгенерированного. |
| `scripts/semgrep.ts` | Все флаги, пин версии, список выключенных правил, режимы. Единственное место, где читают флаги. |
| `.semgrep/rules/*.yaml` | Правила с файловыми allowlist'ами. Каждый исключённый путь — утверждение «источник безопасен». |
| `docs/runbooks/semgrep.md` | Инструкция для человека: как поставить, как гонять, как реагировать на находку. |

---

## 4. Определение готовности

- [ ] `bun run security:semgrep` из корня → `Findings: 0`, exit code `0`.
- [ ] `bun run security:semgrep:test` → exit `0` (`No unit tests found` до появления фикстур, `All tests passed` после).
- [ ] `bun run security:semgrep:diff` на ветке без изменений → `Findings: 0`, exit `0`.
- [ ] `bun run validate` зелёный, `bun run spellcheck` зелёный.
- [ ] В `.github/workflows/global-ci.yml` job `security` падает при новой находке в PR.
- [ ] `docs/runbooks/semgrep.md` описывает установку, три режима и политику §2.
- [ ] Ни одного `nosemgrep` без id правила и причины.

---

## Task 0: Ветка и тикет

**Files:** нет.

**Interfaces:**
- Produces: ветка, на которой выполняются задачи 1–9; номер issue `<redos-ticket>` для задачи 6.

- [ ] **Step 1: Создать issue в Linear**

Проект — тот, где живёт техдолг (`/git-linear` или Linear MCP). Заголовок: `Adopt Semgrep as a PR gate`. В описании — ссылка на §1 этого файла. Записать номер `DXNX-<n>`.

- [ ] **Step 2: Создать ветку от `main`**

```bash
git switch main && git pull
git switch -c "chore/dxnx-<n>-semgrep-adoption"
```

- [ ] **Step 3: Проверить версию Semgrep**

Run: `semgrep --version`
Expected: `1.182.1`. Если команды нет:

```bash
pipx install "semgrep==1.182.1"     # или: uv tool install "semgrep==1.182.1"
```

Если установлена другая версия — зафиксировать её и заменить `1.182.1` во всех трёх местах из Global Constraints.

---

## Task 1: `.semgrepignore`

**Files:**
- Create: `.semgrepignore`

**Interfaces:**
- Produces: границы сканирования, на которые опираются задачи 2–8.

- [ ] **Step 1: Зафиксировать исходное состояние**

Run: `semgrep scan --config p/default --metrics off . 2>&1 | grep "\.agents/"`
Expected: 6 строк с `.agents/skills/…` (1 websocket, 4 в `server.cjs`, 1 в `evaluation.py`).

- [ ] **Step 2: Создать `.semgrepignore`**

```gitignore
# Vendored third-party skills; renovate.json already ignores this path.
.agents/
.claude/
.cursor/
.continue/

# Local patches applied to dependencies.
patches/

# Generated: source of truth is *.zmodel / the generators.
apps/web/prisma/schema.prisma
apps/web/prisma/generated/
apps/web/src/server/core/field-encryption/config.generated.ts
apps/web/messages/en.d.json.ts
packages/shared/src/enums/index.ts
apps/siem-server/dist/
```

- [ ] **Step 3: Проверить, что вендоренный код больше не сканируется**

Run:

```bash
semgrep scan --config p/default --metrics off . 2>&1 | grep -c "\.agents/" || true
```

Expected: `0` (grep вернёт `1`, потому что совпадений нет — это нормально).

- [ ] **Step 4: Проверить, что python-правила ушли из прогона**

Run: `semgrep scan --config p/default --metrics off . 2>&1 | grep -iE "python|Parsed lines"`
Expected: строки `python` в таблице CODE RULES больше нет.

- [ ] **Step 5: Commit**

```bash
git add .semgrepignore
git commit -m "chore(tooling): ignore vendored and generated code in semgrep"
```

---

## Task 2: `.semgrep/rules/` — два правила с allowlist

**Files:**
- Create: `.semgrep/rules/dxnx-non-literal-regexp.yaml`
- Create: `.semgrep/rules/dxnx-react-dangerously-set-inner-html.yaml`

**Interfaces:**
- Produces:
  - id `dxnx-non-literal-regexp` — на него ссылаются `nosemgrep` в задаче 6 и `--exclude-rule` в задаче 3.
  - id `dxnx-react-dangerously-set-inner-html` — только allowlist, подавлений не требует.
  - Оба правила используют `paths.exclude` с путями, анкоренными от корня (`/apps/...`). Без ведущего слэша Semgrep выдаёт предупреждение о будущей смене семантики.

Это **копии** registry-правил с двумя изменениями: новый `id` и `paths.exclude`. Taint-режим сохранён — без него правило перестанет ловить «параметр функции → sink». Механизм замены шумного правила копией с allowlist описан в документации Semgrep (`docs.semgrep.dev/kb/rules/exclude_rule_for_certain_filetypes`).

- [ ] **Step 1: Создать `.semgrep/rules/dxnx-non-literal-regexp.yaml`**

```yaml
rules:
  - id: dxnx-non-literal-regexp
    message: >-
      RegExp() is built from a non-literal value. If that value is user-controlled this is a
      ReDoS surface. Escaping or validation must be visible at the call site; vetted files are
      listed in paths.exclude.
    metadata:
      cwe:
        - "CWE-1333: Inefficient Regular Expression Complexity"
      category: security
      confidence: LOW
      source-rule: javascript.lang.security.audit.detect-non-literal-regexp
    languages:
      - javascript
      - typescript
    severity: WARNING
    mode: taint
    paths:
      exclude:
        - "/apps/web/src/shared/lib/cookies.ts"
        - "/apps/web/src/features/repo-setup/model/terminal-logs.ts"
        - "/apps/web/src/server/modules/analysis/engine/core/framework-catalog.ts"
        - "/apps/web/src/server/modules/analysis/engine/extractors/regex-signal-specs.test.ts"
    pattern-sources:
      - patterns:
          - pattern-inside: |
              function ... (...,$ARG,...) {...}
          - focus-metavariable: $ARG
    pattern-sinks:
      - patterns:
          - pattern-either:
              - pattern: new RegExp($ARG, ...)
              - pattern: RegExp($ARG, ...)
          - pattern-not: RegExp("...", ...)
          - pattern-not: new RegExp("...", ...)
          - pattern-not: RegExp(/.../, ...)
          - pattern-not: new RegExp(/.../, ...)
```

Почему эти четыре пути безопасны (это и есть содержание решения):

| Путь | Почему |
|---|---|
| `cookies.ts` | `name` экранируется перед подстановкой: `replaceAll(/([$()*+./?[\\\]^{|}])/g, "\\$1")`; значение — константа вызова. |
| `terminal-logs.ts` | `highlight` экранируется `replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")` перед `new RegExp`. |
| `framework-catalog.ts` | `alias` экранируется тем же приёмом; паттерн собирается из статического каталога фреймворков. |
| `regex-signal-specs.test.ts` | Тест: `route.pattern` — литеральный `RegExp` из фикстуры, `.source`/`.flags` копируются как есть. |

Три локации в SIEM намеренно **не** в allowlist: они закрываются в задаче 6.

- [ ] **Step 2: Создать `.semgrep/rules/dxnx-react-dangerously-set-inner-html.yaml`**

```yaml
rules:
  - id: dxnx-react-dangerously-set-inner-html
    message: >-
      dangerouslySetInnerHTML is rendered from a non-constant value. Only reviewed sources may
      reach this sink: shiki output, rehype-sanitize output (markdown-to-html.ts), mermaid strict
      mode. A new render path must be added to paths.exclude with a one-line justification.
    metadata:
      cwe:
        - "CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')"
      category: security
      confidence: LOW
      technology:
        - react
      source-rule: typescript.react.security.audit.react-dangerouslysetinnerhtml
    languages:
      - typescript
      - javascript
    severity: WARNING
    mode: taint
    paths:
      exclude:
        - "/apps/web/src/entities/audit-log/ui/audit-log-sheet.tsx"
        - "/apps/web/src/features/admin/ui/admin-audit-payload-sheet.tsx"
        - "/apps/web/src/features/repo-code-viewer/ui/repo-code-browser.tsx"
        - "/apps/web/src/features/repo-docs-viewer/ui/repo-docs-content.tsx"
        - "/apps/web/src/shared/ui/core/mermaid.tsx"
        - "/apps/web/src/shared/ui/kit/code-window.tsx"
    pattern-sources:
      - patterns:
          - pattern-either:
              - pattern-inside: |
                  function ...({..., $X, ...}) { ... }
              - pattern-inside: |
                  function ...(..., $X, ...) { ... }
          - focus-metavariable: $X
          - pattern-not-inside: |
                $F. ... .$SANITIZEUNC(...)
    pattern-sinks:
      - patterns:
          - focus-metavariable: $X
          - pattern-either:
              - pattern: |
                  {...,dangerouslySetInnerHTML: {__html: $X},...}
              - pattern: |
                  <$Y ... dangerouslySetInnerHTML={{__html: $X}} />
          - pattern-not: |
              <$Y ... dangerouslySetInnerHTML={{__html: "..."}} />
          - pattern-not: |
              {...,dangerouslySetInnerHTML:{__html: "..."},...}
          - metavariable-pattern:
              patterns:
                - pattern-not: |
                    {...}
              metavariable: $X
          - pattern-not: |
              <... {__html: "..."} ...>
          - pattern-not: |
              <... {__html: `...`} ...>
```

`pattern-sanitizers` из оригинала не копируются: DOMPurify/xss/sanitize-html в репозитории не используются, их роль выполняет allowlist.

Почему эти шесть путей безопасны:

| Путь | Источник `__html` |
|---|---|
| `audit-log-sheet.tsx`, `admin-audit-payload-sheet.tsx` | `auditService.getLogPayloadHtml` → `sanitizeObject` + `highlightCode` (shiki экранирует текст). |
| `repo-code-browser.tsx`, `code-window.tsx` | Shiki `codeToHtml` — экранирование внутри библиотеки. |
| `repo-docs-content.tsx` | `markdown-to-html.ts`: `rehypeRaw` → **`rehypeSanitize`** → `rehypeShiki` (порядок верный). |
| `mermaid.tsx` | `mermaid-render.ts` с `securityLevel: "strict"`. |

- [ ] **Step 3: Проверить, что копии живые, а allowlist'ы работают**

Run:

```bash
semgrep scan --config .semgrep/rules --no-rewrite-rule-ids --metrics off . 2>&1 \
  | grep -E "Findings|dxnx-"
```

Expected: `Findings: 3`, все три — `dxnx-non-literal-regexp` в SIEM (`rules.schema.ts`, `scan.engine.ts`, `packages/shared/src/schemas/siem/index.ts`). `dxnx-react-dangerously-set-inner-html` не срабатывает ни разу.

- [ ] **Step 4: Контроль: копия JSX-правила не «мертва»**

```bash
printf 'export function X({ raw }: { raw: string }) {\n  return <div dangerouslySetInnerHTML={{ __html: raw }} />;\n}\n' \
  > /tmp/probe-inner-html.tsx
semgrep scan --config .semgrep/rules --no-rewrite-rule-ids --metrics off /tmp/probe-inner-html.tsx 2>&1 \
  | grep -c "dxnx-react-dangerously-set-inner-html"
```

Expected: `1` — файл вне репозитория, allowlist не применяется.

- [ ] **Step 5: Контроль: копия regexp-правила не «мертва»**

```bash
printf 'export function build(name: string): RegExp {\n  return new RegExp(name);\n}\n' \
  > /tmp/probe-regexp.ts
semgrep scan --config .semgrep/rules --no-rewrite-rule-ids --metrics off /tmp/probe-regexp.ts 2>&1 \
  | grep -c "dxnx-non-literal-regexp"
```

Expected: `1`

- [ ] **Step 6: Commit**

```bash
git add .semgrep/rules
git commit -m "feat(security): add semgrep allowlist rules"
```

---

## Task 3: `scripts/semgrep.ts` — единственный вход

**Files:**
- Create: `scripts/semgrep.ts`
- Modify: `package.json` (блок `scripts`)
- Modify: `cspell.json` (`ignorePaths`, `words`)
- Modify: `biome.json` (`files.includes`)

**Interfaces:**
- Consumes: `.semgrep/rules/` (задача 2) и id `dxnx-non-literal-regexp`.
- Produces:
  - CLI: `bun scripts/semgrep.ts` (full), `--diff` (diff-aware против `origin/main` или `$SEMGREP_BASELINE`), `--test` (юнит-тесты правил).
  - `SEMGREP_VERSION = "1.182.1"` — единственный источник версии для локальной проверки.
  - `EXCLUDED_RULES` — 7 правил, выключенных на весь репозиторий.
  - npm-скрипты `security:semgrep`, `security:semgrep:diff`, `security:semgrep:test` — их вызывает задача 8.

- [ ] **Step 1: Создать `scripts/semgrep.ts`**

```ts
import { execFileSync, spawn } from "node:child_process";

const SEMGREP_VERSION = "1.182.1";
const RULES_DIR = ".semgrep/rules";

// Rules dropped for the whole repo. Per-file decisions live in .semgrep/rules/.
const EXCLUDED_RULES = [
  "generic.secrets.security.detected-jwt-token.detected-jwt-token",
  "generic.secrets.security.detected-stripe-api-key.detected-stripe-api-key",
  "javascript.audit.detect-replaceall-sanitization.detect-replaceall-sanitization",
  "javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp",
  "package_managers.bun.bun-missing-minimum-release-age.bun-missing-minimum-release-age",
  "package_managers.renovate.renovate-missing-minimum-release-age.renovate-missing-minimum-release-age",
  "typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml",
];

const BASE_ARGS = [
  "--config",
  "p/default",
  "--config",
  RULES_DIR,
  "--no-rewrite-rule-ids",
  "--metrics",
  "off",
  "--max-target-bytes",
  "500000",
  "--error",
  ...EXCLUDED_RULES.flatMap((rule) => ["--exclude-rule", rule]),
];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assertInstalledVersion(): void {
  let installed: string;

  try {
    installed = execFileSync("semgrep", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    fail(
      [
        `semgrep is not installed. CI pins ${SEMGREP_VERSION}.`,
        `  pipx install "semgrep==${SEMGREP_VERSION}"`,
        `  uv tool install "semgrep==${SEMGREP_VERSION}"`,
      ].join("\n"),
    );
  }

  if (installed !== SEMGREP_VERSION) {
    fail(
      `semgrep ${installed} is installed, but CI pins ${SEMGREP_VERSION}.\n` +
        `  pipx install --force "semgrep==${SEMGREP_VERSION}"`,
    );
  }
}

function baselineCommit(): string {
  const fromEnv = process.env.SEMGREP_BASELINE?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  try {
    return execFileSync("git", ["merge-base", "HEAD", "origin/main"], { encoding: "utf8" }).trim();
  } catch {
    return fail("Cannot compute the merge base against origin/main. Run `git fetch origin main`.");
  }
}

assertInstalledVersion();

const argv = process.argv.slice(2);
const wantsDiff = argv.includes("--diff");
const passthrough = argv.filter((arg) => arg !== "--diff" && arg !== "--test");

const args = argv.includes("--test")
  ? ["--test", RULES_DIR]
  : [
      "scan",
      ...BASE_ARGS,
      ...(wantsDiff ? ["--baseline-commit", baselineCommit()] : []),
      ...passthrough,
      ".",
    ];

const child = spawn("semgrep", args, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
```

- [ ] **Step 2: Добавить скрипты в `package.json`**

Блок `scripts` (Biome отсортирует ключи сам на `bun run format`):

```json
"security:semgrep": "bun scripts/semgrep.ts",
"security:semgrep:diff": "bun scripts/semgrep.ts --diff",
"security:semgrep:test": "bun scripts/semgrep.ts --test"
```

- [ ] **Step 3: Исключить `.semgrep/` из форматтера и проверки орфографии**

В `biome.json` → `files.includes` добавить рядом с `"!!**/.agents"`:

```json
"!!**/.semgrep"
```

В `cspell.json` → `ignorePaths` добавить:

```json
"**/.semgrep/**"
```

В `cspell.json` → `words` добавить (массив отсортирован, встаёт между `selftest` и `sendmail`):

```json
"semgrep"
```

- [ ] **Step 4: Прогнать скан и сверить состав находок**

Run: `bun run security:semgrep 2>&1 | grep -E "Rules run|Findings"`
Expected: `Findings: 14` — ровно те, что перечислены в §1.1 и §1.4 (1 gha, 1 gcm, 3 SIEM regexp, 3 formatstring, 2 spawn, 2 script-tag, 1 prototype, 1 urllib).

Если число другое — сверить по списку правил, а не подгонять цифру: любая находка вне таблиц §1.1–§1.4 требует решения по §2.

Run: `bun run security:semgrep 2>&1 | grep -cE "detected-stripe-api-key|detected-jwt-token|minimum-release-age|detect-replaceall-sanitization|react-dangerouslysetinnerhtml|lang.security.audit.detect-non-literal-regexp" || true`
Expected: `0` — все семь исключённых id молчат (копия называется `dxnx-non-literal-regexp`, поэтому последняя альтернатива не ловит её).

- [ ] **Step 5: Проверить сообщение о несовпадении версии**

Run:

```bash
PATH="$(dirname "$(command -v bun)"):/usr/bin:/bin" bun run security:semgrep
echo "exit=$?"
```

Expected: `semgrep is not installed. CI pins 1.182.1.` и `exit=1` (`~/.local/bin` убран из PATH, поэтому бинарь не найден, а bun остался).

- [ ] **Step 6: Форматирование**

Run: `bun run format && bun run format:check`
Expected: оба зелёные. Если Biome переставил ключи в `package.json` — это ожидаемо, закоммитить как есть.

- [ ] **Step 7: Commit**

```bash
git add scripts/semgrep.ts package.json cspell.json biome.json
git commit -m "feat(tooling): add single-entry semgrep runner"
```

---

## Task 4: Секрет в `web-ci.yml` — сузить область

**Files:**
- Modify: `.github/workflows/web-ci.yml` (workflow-level `env:`; job'ы `types`, `tests`, `migrations`)

**Interfaces:**
- Produces: `PRISMA_FIELD_ENCRYPTION_KEY` доступен только job'ам, которые ходят в БД.

- [ ] **Step 1: Воспроизвести находку**

Run: `bun run security:semgrep 2>&1 | grep -A3 "gha-workflow-env-secret"`
Expected: находка на `.github/workflows/web-ci.yml:40`.

- [ ] **Step 2: Удалить ключ из workflow-level `env:`**

В блоке `env:` (после `NODE_OPTIONS`) удалить строку:

```yaml
  PRISMA_FIELD_ENCRYPTION_KEY: ${{ secrets.PRISMA_FIELD_ENCRYPTION_KEY }}
```

Остальные строки не трогать: это литералы (`"dummy-jwt-secret"`, `"gsk_dummy"` и т.д.), они не являются секретами.

- [ ] **Step 3: Добавить ключ в три job'а, которые трогают БД**

В job `types`, `tests`, `migrations` добавить `env:` на уровне job'а (рядом с `timeout-minutes`):

```yaml
    env:
      PRISMA_FIELD_ENCRYPTION_KEY: ${{ secrets.PRISMA_FIELD_ENCRYPTION_KEY }}
```

- [ ] **Step 4: Проверить область видимости**

Run: `grep -n "PRISMA_FIELD_ENCRYPTION_KEY" .github/workflows/web-ci.yml`
Expected: 3 вхождения, все внутри job'ов; в workflow-level `env:` (строки 33–42) — ни одного.

Run: `grep -rn "PRISMA_FIELD_ENCRYPTION_KEY" apps/web/src --include='*.ts' | grep -v "\.test\." `
Expected: только `server/core/field-encryption/*`; эти модули исполняются в тестах и `db:push`, но не в `lint`/`format`.

- [ ] **Step 5: Убедиться, что находка исчезла**

Run: `bun run security:semgrep 2>&1 | grep -c "gha-workflow-env-secret" || true`
Expected: `0`

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/web-ci.yml
git commit -m "ci(web): scope field encryption secret to db jobs"
```

---

## Task 5: `cipher.ts` — зафиксировать длину GCM-тега

**Files:**
- Modify: `apps/web/src/server/core/field-encryption/cipher.ts:86-95`

**Interfaces:**
- Consumes: `AUTH_TAG_BYTES = 16`, `parseEncryptedString`.
- Produces: публичный API (`encryptString`, `decryptString`, `looksEncrypted`, `parseEncryptedString`) не меняется.

Нового теста не пишем осознанно: `cipher.test.ts` уже содержит `"round-trips an empty string"` (строка 44) — это и есть регрессия на `bytes.length <= AUTH_TAG_BYTES`, которая сломала бы шифрование пустых строк. Задача конфигурационная: сообщить Node ожидаемую длину тега.

- [ ] **Step 1: Прогнать существующие тесты до правки**

Run: `bun --filter @doxynix/web test src/server/core/field-encryption/cipher.test.ts`
Expected: `PASS`, все тесты зелёные.

- [ ] **Step 2: Заменить блок расшифровки**

Было:

```ts
  const bytes = Buffer.from(parsed.ciphertext, "base64url");
  const tagStart = bytes.length - AUTH_TAG_BYTES;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    rawKey,
    Buffer.from(parsed.iv, "base64url"),
  );
  decipher.setAuthTag(bytes.subarray(tagStart));
```

Стало:

```ts
  const bytes = Buffer.from(parsed.ciphertext, "base64url");

  if (bytes.length < AUTH_TAG_BYTES) {
    throw new Error("[field-encryption] Ciphertext is shorter than the auth tag");
  }

  const tagStart = bytes.length - AUTH_TAG_BYTES;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    rawKey,
    Buffer.from(parsed.iv, "base64url"),
    { authTagLength: AUTH_TAG_BYTES },
  );
  decipher.setAuthTag(bytes.subarray(tagStart));
```

Условие именно `<`, не `<=`: конверт с пустым plaintext состоит ровно из 16 байт тега и валиден.

- [ ] **Step 3: Прогнать тесты после правки**

Run: `bun --filter @doxynix/web test src/server/core/field-encryption/cipher.test.ts`
Expected: `PASS`, включая `round-trips an empty string` и `decrypts a ciphertext produced by prisma-field-encryption 1.6.0` (совместимость с библиотекой обязана сохраниться).

- [ ] **Step 4: Убедиться, что находка исчезла**

Run: `bun run security:semgrep 2>&1 | grep -c "gcm-no-tag-length" || true`
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/core/field-encryption/cipher.ts
git commit -m "fix(web): pin gcm auth tag length on decrypt"
```

---

## Task 6: SIEM — ReDoS как принятый риск с тикетом

**Files:**
- Modify: `apps/siem-server/src/modules/rules/rules.schema.ts:9`
- Modify: `apps/siem-server/src/modules/scan/scan.engine.ts:51`
- Modify: `packages/shared/src/schemas/siem/index.ts:126`

**Interfaces:**
- Consumes: id `dxnx-non-literal-regexp` (задача 2) — именно он срабатывает после выключения registry-правила.
- Produces: три подавления с одинаковой причиной и одним номером тикета.

Почему подавляем, а не чиним здесь: корректное закрытие — валидация паттерна на катастрофический бэктрекинг (`recheck`) или вынос компиляции в таймаут-воркер. Это отдельный план (§7); смешивать его с внедрением сканера нельзя.

- [ ] **Step 1: Завести тикет на закрытие риска**

Issue в проекте SIEM, label `security`: «bound SIEM rule regex evaluation». Описание: «пользовательский `pattern` из `createRuleSchema` компилируется и исполняется в `analyzeLogContent`; нужен `recheck`-валидатор или таймаут». Номер — `<redos-ticket>`.

- [ ] **Step 2: Подтвердить, что срабатывает именно копия правила**

Run: `bun run security:semgrep 2>&1 | grep -B2 -A2 "dxnx-non-literal-regexp"`
Expected: ровно 3 локации: `rules.schema.ts`, `scan.engine.ts`, `packages/shared/src/schemas/siem/index.ts`.

- [ ] **Step 3: Подавить в `rules.schema.ts`**

```ts
function isValidRegex(pattern: string): boolean {
  try {
    // nosemgrep: dxnx-non-literal-regexp — operator-authored SIEM pattern; ReDoS bound tracked in <redos-ticket>
    const regex = new RegExp(pattern);
    return regex instanceof RegExp;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Подавить в `scan.engine.ts`**

```ts
      try {
        return {
          ...rule,
          // nosemgrep: dxnx-non-literal-regexp — operator-authored SIEM pattern; ReDoS bound tracked in <redos-ticket>
          regex: new RegExp(rule.pattern, "gi"),
        };
      } catch {
        return null;
      }
```

- [ ] **Step 5: Подавить в `packages/shared/src/schemas/siem/index.ts`**

```ts
  // nosemgrep: dxnx-non-literal-regexp — operator-authored SIEM pattern; ReDoS bound tracked in <redos-ticket>
  return new RegExp(pattern) instanceof RegExp;
```

- [ ] **Step 6: Проверить, что находок не осталось, а подавления «живые»**

Run: `bun run security:semgrep 2>&1 | grep -c "dxnx-non-literal-regexp" || true`
Expected: `0`

Контроль: временно удалить один комментарий, прогнать скан, увидеть находку, вернуть комментарий. Иначе нельзя отличить «подавил» от «ошибся строкой».

- [ ] **Step 7: Проверить типы**

Run: `bun run type-check`
Expected: зелёный (тестового скрипта у `@doxynix/siem-server` нет — AGENTS.md).

- [ ] **Step 8: Commit**

```bash
git add apps/siem-server/src/modules/rules/rules.schema.ts \
        apps/siem-server/src/modules/scan/scan.engine.ts \
        packages/shared/src/schemas/siem/index.ts
git commit -m "chore(security): accept semgrep regexp risk in siem rules"
```

---

## Task 7: Остальные точечные подавления

**Files:**
- Modify: `apps/web/src/shared/ui/kit/console-easter-egg.tsx:50`
- Modify: `scripts/clean-symlinks.ts:40,50`
- Modify: `apps/web/scripts/mutate-single.mjs:73`
- Modify: `apps/web/scripts/zenstack-gen.ts:5`
- Modify: `apps/web/src/server/core/field-encryption/cipher.test.ts:41`
- Modify: `apps/web/src/server/core/field-encryption/rewrite.test.ts:21`
- Modify: `.github/scripts/ci-notify.py:42`

**Interfaces:**
- Consumes: registry-правила из §1.4 (не копии).
- Produces: 8 комментариев `nosemgrep`; после задачи `grep -rc nosemgrep` по этим файлам даёт в сумме 8.

- [ ] **Step 1: Подавить `unsafe-formatstring`**

`apps/web/src/shared/ui/kit/console-easter-egg.tsx`:

```tsx
  // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring — static banner, no user input
  console.info(`%c${asciiArt}`, asciiStyle);
```

`scripts/clean-symlinks.ts` (строки 40 и 50):

```ts
  // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring — error object, no user input
  console.error(`⚠️ [clean:symlinks] Error reading ${bunCacheDir}:`, error?.message ?? error);
```

```ts
  // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring — error object, no user input
  console.error(`⚠️ [clean:symlinks] Error removing ${directNested}:`, error?.message ?? error);
```

- [ ] **Step 2: Подавить `spawn-shell-true`**

`apps/web/scripts/mutate-single.mjs`:

```js
// nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true — developer CLI args; shell is the Windows shim
const strykerProcess = spawn(strykerBin, args, {
  cwd: webDir,
  shell: isWindows,
  stdio: "inherit",
});
```

`apps/web/scripts/zenstack-gen.ts`:

```ts
// nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true — hardcoded command; shell is the bunx shim
const child = spawn(
  "bunx",
  ["--bun", "zenstack", "generate", "--schema", "prisma/schema.zmodel", "--offline"],
  {
    shell: true,
  },
);
```

- [ ] **Step 3: Подавить тестовые фикстуры**

`apps/web/src/server/core/field-encryption/cipher.test.ts:41`:

```ts
  // nosemgrep: javascript.lang.security.audit.unknown-value-with-script-tag.unknown-value-with-script-tag — test fixture, RAW_KEY is a literal Buffer
  expect(decryptString(encryptString(plaintext, RAW_KEY, "deadbeef"), RAW_KEY)).toBe(plaintext);
```

`apps/web/src/server/core/field-encryption/rewrite.test.ts:21`:

```ts
      // nosemgrep: javascript.lang.security.audit.prototype-pollution.prototype-pollution-loop.prototype-pollution-loop — walks a local JSON fixture
      cursor = (cursor as Record<string, unknown>)[key];
```

- [ ] **Step 4: Подавить `dynamic-urllib-use-detected`**

`.github/scripts/ci-notify.py`:

```python
    # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected — URL is built from the hardcoded GitHub API base
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)
```

- [ ] **Step 5: Проверить, что все подавления применились**

Run:

```bash
bun run security:semgrep 2>&1 | grep -cE "unsafe-formatstring|spawn-shell-true|unknown-value-with-script-tag|prototype-pollution|dynamic-urllib" || true
```

Expected: `0`

Если правило всё ещё срабатывает — комментарий стоит не на той строке. Для многострочных находок (`spawn(...)`) Semgrep ищет `nosemgrep` внутри диапазона совпадения: перенести комментарий внутрь вызова, перед `shell:`.

- [ ] **Step 6: Проверить, что тесты не сломались**

Run: `bun --filter @doxynix/web test src/server/core/field-encryption`
Expected: `PASS`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/shared/ui/kit/console-easter-egg.tsx \
        scripts/clean-symlinks.ts \
        apps/web/scripts/mutate-single.mjs \
        apps/web/scripts/zenstack-gen.ts \
        apps/web/src/server/core/field-encryption/cipher.test.ts \
        apps/web/src/server/core/field-encryption/rewrite.test.ts \
        .github/scripts/ci-notify.py
git commit -m "chore(security): suppress reviewed semgrep false positives"
```

---

## Task 8: CI — гейт в существующем job `security`

**Files:**
- Modify: `.github/workflows/global-ci.yml` (job `security`, после шага `Clean tree-sitter symlinks`)

**Interfaces:**
- Consumes: `bun run security:semgrep`, `bun run security:semgrep:diff` (задача 3); env `SEMGREP_BASELINE` читается скриптом.
- Produces: PR-гейт; job `security` входит в `needs` для `notify`, поэтому падение попадает в уведомление.

Новый workflow не создаём: в репозитории уже есть job `Global Security Scanning` с `fetch-depth: 0`, `Setup Bun`, `secretlint` и `trufflehog`. Semgrep встаёт туда же. `continue-on-error` не добавлять — гейт должен падать.

- [ ] **Step 1: Добавить три шага**

После шага `Clean tree-sitter symlinks` и перед `Run Secretlint`:

```yaml
      - name: Install Semgrep
        run: pipx install "semgrep==1.182.1"

      - name: Semgrep (pull request, diff-aware)
        if: github.event_name == 'pull_request'
        env:
          SEMGREP_BASELINE: ${{ github.event.pull_request.base.sha }}
        run: bun run security:semgrep:diff

      - name: Semgrep (push, full)
        if: github.event_name != 'pull_request'
        run: bun run security:semgrep
```

- [ ] **Step 2: Проверить YAML**

Run: `bun run format:check`
Expected: зелёный (Biome проверяет синтаксис YAML).

Дополнительно, если в окружении есть pyyaml:

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/global-ci.yml')); print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Проверить diff-режим на пробной находке**

`--baseline-commit` смотрит только на **закоммиченные** изменения, поэтому пробу нужно закоммитить на временной ветке:

```bash
git switch -c tmp/dxnx-0-semgrep-smoke
printf 'export function build(name: string): RegExp {\n  return new RegExp(name);\n}\n' \
  > apps/web/src/server/__semgrep_probe.ts
git add apps/web/src/server/__semgrep_probe.ts
git commit -m "chore: semgrep probe"
bun run security:semgrep:diff
echo "exit=$?"
```

Expected: одна находка `dxnx-non-literal-regexp` в `apps/web/src/server/__semgrep_probe.ts`, `exit=1`.

- [ ] **Step 4: Убрать пробу и убедиться, что на чистом дереве гейт зелёный**

```bash
git switch -
git branch -D tmp/dxnx-0-semgrep-smoke
bun run security:semgrep:diff
echo "exit=$?"
```

Expected: `Findings: 0`, `exit=0`. Ветка удаляется вместе с коммитом-пробой, файл в рабочем дереве не остаётся.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/global-ci.yml
git commit -m "ci: run semgrep in the global security job"
```

---

## Task 9: Runbook и указатель в AGENTS.md

**Files:**
- Create: `docs/runbooks/semgrep.md`
- Modify: `AGENTS.md` (таблица Commands, после строки про `knip`)

**Interfaces:**
- Consumes: `scripts/semgrep.ts`, `.semgrep/rules/`, `.github/workflows/global-ci.yml`.
- Produces: единственное место, где описано, как реагировать на находку.

- [ ] **Step 1: Создать `docs/runbooks/semgrep.md`**

````markdown
# Semgrep

Semgrep — SAST-гейт для всего монорепо. Локальный и CI-прогон идут через один скрипт,
поэтому флаги правятся в одном месте: `scripts/semgrep.ts`.

## Установка

Версия зафиксирована в `scripts/semgrep.ts` (`SEMGREP_VERSION`) и в
`.github/workflows/global-ci.yml`. Локальная версия обязана совпадать, иначе скрипт
падает с явным сообщением.

```bash
pipx install "semgrep==1.182.1"          # или: uv tool install "semgrep==1.182.1"
semgrep --version                        # 1.182.1
```

Docker-вариант (без Python на хосте):

```bash
docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep:1.182.1 semgrep --version
```

## Режимы

| Команда | Что делает | Когда |
|---|---|---|
| `bun run security:semgrep` | полный скан, `--error` | перед PR, при разборе легаси |
| `bun run security:semgrep:diff` | только новые находки против `origin/main` (или `$SEMGREP_BASELINE`) | локально перед пушем; так же гоняет CI на PR |
| `bun run security:semgrep:test` | юнит-тесты правил из `.semgrep/rules/` | после правки любого правила |

Запускать из корня репозитория: `paths.exclude` и `.semgrepignore` считаются от корня.

## Что входит в скан

- `p/default` — registry-правила, обновляются вместе с версией Semgrep.
- `.semgrep/rules/` — наши правила:
  - `dxnx-non-literal-regexp` — копия registry-правила с allowlist проверенных путей;
  - `dxnx-react-dangerously-set-inner-html` — то же для `dangerouslySetInnerHTML`.
- `.semgrepignore` — вендоренный и сгенерированный код.

Пять правил выключены целиком через `--exclude-rule` в `scripts/semgrep.ts`: два secrets-правила
(дублируют gitleaks/secretlint), `detect-replaceall-sanitization` (экранирование `& < > "`
корректно), два `minimumReleaseAge` (у нас осознанно 3 дня).

## Находка: что делать

Порядок обязателен, подробности — §2 плана `docs/superpowers/plans/2026-11-01-semgrep-adoption.md`:

1. Код не наш → `.semgrepignore`.
2. Правило не подходит репозиторию → `--exclude-rule` в `scripts/semgrep.ts` + комментарий «почему».
3. Правило верное, пути проверены → копия правила с `paths.exclude` + причина.
4. Одна строка проверена → `// nosemgrep: <rule-id> — <причина>`.
5. Непонятно → оставить красным и завести тикет.

`nosemgrep` без id правила и без причины не принимается на ревью.

## Если CI упал на новом правиле p/default

Правила в registry обновляются независимо от нас. Воспроизвести локально
(`bun run security:semgrep`), затем решить по шагам выше. Не отключать правило целиком,
пока не понятно, что именно оно ловит.
````

- [ ] **Step 2: Добавить строку в таблицу Commands в `AGENTS.md`**

После строки про `knip`:

```markdown
| Security scan | `bun run security:semgrep` (full) · `bun run security:semgrep:diff` (PR diff) |
```

- [ ] **Step 3: Проверить орфографию и форматирование**

Run: `bun run spellcheck`
Expected: зелёный (`docs/runbooks/**` в `cspell.json` уже игнорируется; слово `semgrep` добавлено в словарь в задаче 3).

Run: `bun run format:check`
Expected: зелёный.

- [ ] **Step 4: Финальный полный гейт**

Run: `bun run validate`
Expected: зелёный. Если падает `lint:locales`/`lint:i18n` — проверить `git status`: в этой задаче файлы локалей не меняются.

- [ ] **Step 5: Commit**

```bash
git add docs/runbooks/semgrep.md AGENTS.md
git commit -m "docs(tooling): document the semgrep workflow"
```

---

## 5. Финальная верификация

Выполнить подряд из корня, все команды должны пройти:

```bash
bun run security:semgrep:test
bun run security:semgrep
echo "full exit=$?"

git switch -c tmp/dxnx-0-verify
printf 'export function build(name: string): RegExp {\n  return new RegExp(name);\n}\n' \
  > apps/web/src/server/__semgrep_probe.ts
git add apps/web/src/server/__semgrep_probe.ts
git commit -m "chore: semgrep probe"
bun run security:semgrep:diff
echo "diff exit=$?"
git switch -
git branch -D tmp/dxnx-0-verify

bun run format:check
bun run spellcheck
bun run validate
```

Ожидаемо: `test` — exit `0`; `full` — `Findings: 0`, `exit=0`; `diff` — одна находка `dxnx-non-literal-regexp`, `exit=1`; остальное зелёное.

## 6. Откат

Всё внедрение аддитивное, кроме задач 4–7. Откат по частям:

- Сканер: удалить `.semgrepignore`, `.semgrep/`, `scripts/semgrep.ts`, три npm-скрипта, шаги в `global-ci.yml`. Код приложения не затронут.
- Задача 4: вернуть строку в workflow-level `env:`.
- Задача 5: вернуть `createDecipheriv` без `authTagLength` (тесты останутся зелёными — правка только ужесточает проверку).
- Задачи 6–7: удалить комментарии `nosemgrep`, находки вернутся в отчёт.

## 7. Non-goals и фаза 2

Не входит в этот план:

- `p/security-audit`, `p/owasp-top-ten`, `p/secrets` поверх `p/default`: сначала базовый гейт должен быть зелёным и понятным.
- `semgrep ci` и Semgrep AppSec Platform (`SEMGREP_APP_TOKEN`): бесплатный tier даёт Pro-правила и PR-комментарии, но добавляет вендора и переносит политику из репозитория на платформу. Отдельное решение.
- SARIF-загрузка в GitHub code scanning: CodeQL уже публикует результаты; второй отчёт требует отдельной `category` и дублирует UI.
- Pre-commit хук: полный скан — десятки секунд, в Lefthook не место. Опционально — ручной `bun run security:semgrep:diff`.
- Автофиксы (`--autofix`): ни одно из текущих правил не даёт безопасного фикса.
- **Закрытие ReDoS в SIEM** (задача 6): нужен `recheck`-валидатор в `createRuleSchema` или таймаут-воркер в `analyzeLogContent`. Отдельный план.
- **Собственные правила репозитория.** Напрашиваются `dxnx-use-pathe-not-node-path` (AGENTS.md требует `pathe`) и проверка `id` в `*.zmodel` (`@db.Uuid`, без `@omit`). Оба сегодня дали бы находки на существующем коде: три импорта `node:path` (`apps/web/scripts/mutate-single.mjs`, `scripts/clean-symlinks.ts`, `apps/web/src/server/utils/pagination.test.ts`). Правило добавляется после их починки, иначе гейт красный «из-за истории».
- Замена `PRISMA_FIELD_ENCRYPTION_KEY` на литеральный тестовый ключ, чтобы убрать настоящий секрет из PR-воркфлоу совсем. Сейчас сужено до трёх job'ов; проверка требует прогона `db:push` + `test:int` в CI.

## 8. Риски и как их заметить

| Риск | Признак | Что делать |
|---|---|---|
| Локальная версия Semgrep разошлась с CI | скрипт падает с `semgrep X is installed, but CI pins Y` | `pipx install --force "semgrep==Y"`; версия меняется в трёх местах сразу |
| Registry обновил `p/default`, main покраснел | упал push-скан без изменений в коде | триаж по §2, не отключать правило вслепую |
| `nosemgrep` перестал совпадать с находкой после рефакторинга | находка вернулась | обновить комментарий или удалить его |
| Allowlist в копии правила разросся | `paths.exclude` длиннее 6–7 путей | сигнал, что подход в коде неверный: обсуждать архитектуру, а не добавлять пути |
| `pipx` отсутствует на runner'е | шаг `Install Semgrep` падает с `command not found` | заменить на `python3 -m venv` + `pip install` или на контейнер `semgrep/semgrep` |
| Скан замедлился | полный прогон > 2 минут | проверить, что `.agents` и `dist` в `.semgrepignore`; при необходимости `--jobs` и `--max-target-bytes` |
| Копия правила разошлась с registry-оригиналом | upstream починил ложные срабатывания, у нас старая логика | раз в квартал: сравнить `source-rule` в `metadata` с актуальным YAML в registry |

## 9. Решение, которое нужно подтвердить владельцу

**`minimumReleaseAge`: 3 дня или 7?** План по умолчанию сохраняет текущие 3 дня (`bunfig.toml`, `renovate.json`) и выключает два правила. Альтернатива: выставить `604800` / `"7 days"`, убрать два id из `EXCLUDED_RULES` в `scripts/semgrep.ts` и вычеркнуть их из §1.2.
