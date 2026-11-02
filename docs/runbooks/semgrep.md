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
