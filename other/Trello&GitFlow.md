Чеклист: Trello + GitFlow для проекта (Next.js + tRPC + pnpm)
1. Общая цель (коротко)

Делать работу по задачам через Trello → создавать ветки по карточке → коммитить с ID карточки → PR в develop → периодические релизы develop → main.

main — защищён и только для релизов. develop — интеграция. feature/*, fix/*, hotfix/* — рабочие ветки.

2. Trello — что настроить

Создать Workspace (например Diploma - Next.js) и доску Development.

Списки: Backlog, To Do, In Progress, Review / QA, Done.

В карточке: ставь метки, чек-лист и дедлайн. Всегда держи ссылку на PR и событие CI в карточке.

Как взять ID карточки: открой карточку → в URL https://trello.com/c/<CARDID>/... → <CARDID> копируешь и используешь в названии ветки/коммите.



3. Branch naming (обязательное правило)

Формат ветки:

<type>/<TRELLOID>-short-description


Типы:

feature/ — новая фича

fix/ — багфикс

chore/ — вспомогательные задачи

hotfix/ — экстренный фикс на main

Примеры:

feature/W8a9K-add-github-oauth
fix/W8a9K-redirect-bug
chore/W8a9K-setup-prisma

4. Commit message (обязательное правило)

Формат (Conventional + Trello ID):

<type>(scope): short description (CARDID)


Примеры:

feat(auth): add GitHub OAuth (W8a9K)
fix(login): handle callback redirect (W8a9K)
chore(deps): add @upstash/qstash (X3b2P)


— Это упрощает поиск и автоматизацию changelog.

5. Pull Request — чеклист (при создании PR)

Заполняй PR с этим минимумом:

Заголовок: feat: <коротко> (CARDID)

Описание:

Ссылка на Trello карточку: https://trello.com/c/<CARDID>

Короткое описание, что сделано

Что проверить локально (команды)

Список необходимых миграций или env переменных

Checklist в PR (вставь в шаблон):

 Код проходит pnpm lint

 pnpm build проходит

 pnpm typecheck проходит

 Тесты (если есть) — пройдены

 Добавил(а) ссылку на Trello карточку

Используй файл /.github/PULL_REQUEST_TEMPLATE.md — ниже шаблон в разделе «Файлы/сниппеты».

6. Branch protection (на GitHub / Git provider)

Создать правило защиты для main (и опционально develop):

Branch name pattern: main

Require pull request before merging — ON

Require status checks to pass — ON (lint, build, typecheck)

Require approving reviews — 1 (или 0, если один разработчик)

Include administrators — включить (чтобы даже админ не пушил напрямую)

Disable force pushes

После этого прямой git push origin main будет запрещён.

7. CI / Checks (минимум, ставить как обязательные)

В GitHub Actions (или другой CI) сделать workflow, который запускает:

pnpm install

pnpm -w build / pnpm run build (в web)

pnpm -w test (если есть тесты)

pnpm -w lint (eslint --max-warnings=0)

pnpm -w typecheck (tsc --noEmit)

prisma generate и миграции check (если требует)

Отметить эти шаги как обязательные в Branch Protection

8. Husky + lint-staged — локальная защита

Установи husky и lint-staged, добавь хуки:
package.json (примерные строки):

"husky": {
  "hooks": {
    "pre-commit": "lint-staged",
    "pre-push": "bash .husky/pre-push.sh"
  }
},
"lint-staged": {
  "*.ts?(x)": [
    "pnpm -w lint --fix",
    "pnpm -w format",
    "git add"
  ]
}


.husky/pre-push.sh (пример — предотвращает пуш в main):

#!/usr/bin/env bash
branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" = "main" ]; then
  echo "Pushing to 'main' is disabled. Use PRs."
  exit 1
fi


(Скрипт удобен для самозащиты, но окончательная защита — на сервере.)

9. Workflow: шаги при работе над задачей (коротко)

В Trello: переместить карточку в In Progress.

Создать ветку:

git checkout -b feature/<CARDID>-short


Работать, коммитить по правилам:

git add .
git commit -m "feat(auth): add GitHub OAuth (CARDID)"


Push ветки:

git push -u origin feature/<CARDID>-short


Создать PR → target develop → вставить Trello-ссылку → ждать CI ✅

После merge → в Trello переводишь карточку в Review / QA или Done (или делай автоматизацию).

Регулярно мерджить develop → main через PR для релизов.

10. Trello ↔ Git автоматизация (опционально)

Подключи GitHub Power-Up в Trello (показывает PRs, commits в карточке).

Можно использовать GitHub Actions / Zapier / n8n / интеграции, которые по событию PR перекидывают карточку в Done.

Если не хочешь автоматизацию — достаточно указывать CARDID в PR и вручную переводить карточку.

11. Специфические пункты для твоего стека
Prisma

Миграции делай в feature-ветках, но применяй миграции в CI перед merge или в момент релиза.

В PR указывай, есть ли миграции: prisma migrate dev / prisma migrate deploy.

tRPC

Серверный код в apps/web (или packages/server при мульти-аппах).

Клиент импортирует типы через прокси (или опубликованный пакет).

Тестируй endpoints локально (ngrok для мобилки).

QStash / Webhook

В PR укажи, если добавил вебхук; документируй формат payload.

Локальное тестирование: ngrok + тестовые сообщения.

NextAuth / GitHub OAuth

В PR указывай env переменные, которые нужны (GITHUB_ID, GITHUB_SECRET, NEXTAUTH_URL).

12. Полезные файлы/шаблоны (вставь в репу)
A) /.github/PULL_REQUEST_TEMPLATE.md
## Описание
Ссылка на Trello: https://trello.com/c/<CARDID>

Что сделано:
- короткое описание изменений

## Как протестировать локально
- `pnpm install`
- `pnpm dev`
- инструкции

## Чеклист
- [ ] lint (eslint) пройден
- [ ] tsc (typecheck) пройден
- [ ] build проходит
- [ ] миграции (если есть) описаны
- [ ] ссылка на Trello указана

B) CONTRIBUTING.md — кратко правила

branch naming, commit message format, PR rules, локальные команды (pnpm dev, pnpm lint, pnpm typecheck).

13. Полезные git-команды (шаблон)
# создать ветку от develop
git checkout develop
git pull
git checkout -b feature/CARDID-short

# коммит
git add .
git commit -m "feat(auth): add GitHub OAuth (CARDID)"

# пуш
git push -u origin feature/CARDID-short

# мерж в develop (после PR)
git checkout develop
git pull
git merge --no-ff feature/CARDID-short
git push origin develop

# релиз develop -> main
git checkout main
git merge --no-ff develop
git tag v0.1.0
git push origin main --tags

14. Минимальный checklist перед merge в develop

 PR содержит ссылку на Trello карточку

 CI: lint, build, typecheck — зелёные

 Тесты (если есть) — зелёные

 Миграции описаны

 README/документация обновлена (если нужно)

