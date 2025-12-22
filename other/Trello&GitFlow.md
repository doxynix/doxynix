📝 Trello + GitFlow Mini Cheat Sheet

# Правила ветвления
- Flow: feature/* -> develop -> main
- Перед созданием PR: `git rebase origin/develop` для feature, затем `git push --force-with-lease`.
- При мердже выбираем **Squash and merge** или **Rebase and merge**.
- Нельзя делать merge main -> develop без причины.
- Force-push разрешён только для личных feature-веток (`--force-with-lease`).


Полный GitFlow для соло-разработчика
1️⃣ Ветки и их назначение
Ветка	Назначение
main	Продакшн, только релизы. PR туда только из релизных или хотфикс веток.
develop	Интеграционная, staging. Все фичи мерджатся сюда через PR.
feature/*	Новые фичи или задачи. Ветки создаются от develop.
release/*	Ветки для подготовки релиза. Создаются от develop, после тестов идут в main.
hotfix/*	Срочные исправления для продакшна. Создаются от main, потом PR в main и develop.
2️⃣ Правила для всех веток

Никогда не пушить напрямую в main или develop без PR.

Все PR делаются только через GitHub.

Для одного разработчика — можно сам себе ревью.

Перед PR всегда:

git fetch origin
git rebase origin/<base>  # base = develop для feature, main для hotfix
git push --force-with-lease


Мержим только через:

Squash and merge (фичи и хотфиксы)

Rebase and merge (если хочешь линейную историю)

3️⃣ Фича (feature/*)

Создаёшь ветку от develop:

git fetch origin
git checkout -b feature/awesome origin/develop


Работаешь локально.

Чтобы синхронизировать с develop перед PR:

git fetch origin
git rebase origin/develop
git push --force-with-lease


Открываешь PR: feature/awesome -> develop

Название PR = краткое описание фичи

Мержим Squash and merge

После мержа — удаляешь локально и на GitHub:

git branch -d feature/awesome
git push origin --delete feature/awesome

4️⃣ Релиз (release/*)

Создаёшь ветку от develop:

git checkout develop
git checkout -b release/1.0.0


Проверяешь, тестируешь, исправляешь баги.

PR: release/1.0.0 -> main

Мержим через Squash and merge или Rebase and merge

После релиза: PR release/1.0.0 -> develop

Чтобы синхронизировать исправления (например багфиксы во время релиза)

Удаляем release ветку локально и на GitHub:

git branch -d release/1.0.0
git push origin --delete release/1.0.0

5️⃣ Хотфикс (hotfix/*)

Создаёшь ветку от main:

git fetch origin
git checkout -b hotfix/critical-bug origin/main


Работаешь и коммитишь исправление.

PR: hotfix/critical-bug -> main

После успешного CI теста и проверки мержим Squash and merge

PR: hotfix/critical-bug -> develop

Чтобы включить исправление в следующую интеграцию.

Удаляем локально и на GitHub:

git branch -d hotfix/critical-bug
git push origin --delete hotfix/critical-bug

6️⃣ GitHub настройки (чтобы всё шло без боли)

Settings → Branches → Branch protection rules

Для main и develop:

Require PR review (1)

Require status checks (CI)

Require linear history (запрещает merge commits)

Ограничение прямого push (только CI или админ)

Settings → Merge button

Отключить merge commits

Включить Squash and merge

Включить Rebase and merge (по желанию)

7️⃣ Полезные команды
# Создать feature
git checkout -b feature/xxx origin/develop

# Актуализировать feature перед PR
git fetch origin
git rebase origin/develop
git push --force-with-lease

# Создать релиз
git checkout -b release/1.0.0 origin/develop

# Создать хотфикс
git checkout -b hotfix/critical origin/main

# Удалить локально и на GitHub ветку
git branch -d feature/xxx
git push origin --delete feature/xxx

8️⃣ Минимизация ошибок

Никогда не мерджить develop -> feature — только rebase.

Никогда не пушить напрямую в main.

После PR — удаляем feature/release/hotfix ветку.

Использовать линейную историю, squash/rebase.

Хотфиксы мержим сначала в main, потом PR в develop.

1️⃣ Branch Naming
<type>/<TASK_NUMBER>-short-description


Types:

feature/ — фича

fix/ — багфикс

chore/ — вспомогательное

hotfix/ — срочный fix

Example:

feature/12-add-github-oauth
fix/12-redirect-bug
chore/12-setup-prisma

2️⃣ Commit Messages (Conventional)
<type>(<scope>): short description


Types: feat, fix, chore, docs, refactor, test, style

Example:

feat(auth): add GitHub OAuth
fix(login): handle callback redirect
chore(prisma): update schema and generate client


Опционально в коммите можно добавить Trello ссылку:

Trello: https://trello.com/c/fGgQaTYp/12-example-task

3️⃣ Pull Request

Title:

feat: add GitHub OAuth (task #12)


Description template:

Ссылка на Trello: https://trello.com/c/<CARDID>

Что сделано:
- кратко перечислить изменения

Как протестировать локально:
- pnpm install
- pnpm dev

Миграции / env vars (если есть)


PR Checklist:

 pnpm lint ✅

 pnpm typecheck ✅

 pnpm build ✅

 Миграции описаны

 Ссылка на Trello указана

4️⃣ Git Commands Quick
# создать ветку
git checkout develop
git pull
git checkout -b feature/12-add-github-oauth

# коммит
git add .
git commit -m "feat(auth): add GitHub OAuth"

# пуш
git push -u origin feature/12-add-github-oauth

# merge в develop
git checkout develop
git pull
git merge --no-ff feature/12-add-github-oauth
git push origin develop

# релиз develop -> main
git checkout main
git pull
git merge --no-ff develop
git tag v0.1.0
git push origin main --tags

5️⃣ Workflow Quick

Trello → Doing

Создать ветку от develop → feature/12-short

Работа + коммит по Conventional

Пуш ветки → создать PR в develop

CI проходит → merge → Trello → Testing / Done

💡 Tips:

В ветке достаточно номера задачи (12) — коротко и удобно

Для автоматизации можно хранить Trello card ID в PR/коммите

main защищён, пуш только через PR

Pre-commit: lint + typecheck, pre-push: build + tests
